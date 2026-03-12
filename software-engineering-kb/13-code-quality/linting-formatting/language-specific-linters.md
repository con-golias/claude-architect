# Language-Specific Linters (Modern Landscape 2025-2026)

| Attribute    | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | Code Quality > Linting                                             |
| Importance   | High                                                               |
| Last Updated | 2026-03-11                                                         |
| Cross-ref    | [ESLint](eslint.md), [Prettier](prettier.md)                      |

---

## Core Concepts

### The Modern Linting Shift

The linting ecosystem has shifted toward Rust-based tools that are 10--100x faster than
their predecessors. In 2025-2026, the choice is no longer just "which linter" but "which
generation of tooling." Newer tools often combine linting and formatting into a single binary.

### Biome (JavaScript / TypeScript / JSON / CSS)

Biome is a Rust-based toolchain that unifies linting and formatting. Biome 2.0 introduces
type-aware rules via type inference (no `tsconfig.json` dependency for most rules).

```bash
npm install -D @biomejs/biome
npx biome init  # generates biome.json
```

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "complexity": { "noForEach": "warn" },
      "correctness": { "noUnusedVariables": "error" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "trailingCommas": "all" }
  },
  "organizeImports": { "enabled": true }
}
```

Run linting and formatting in one command:

```bash
npx biome check --write .     # Lint + format + organize imports + apply safe fixes
npx biome lint src/            # Lint only
npx biome format --write src/  # Format only
```

**Biome 2.0 type-aware rules** infer types without a TypeScript project setup. Rules like
`noFloatingPromises` and `noMisusedPromises` work via Biome's own type inference engine.

**When to choose Biome:** JS/TS-only projects that want a single tool replacing ESLint +
Prettier + import sorting. The plugin ecosystem is growing but smaller than ESLint's.

### Oxlint v1.0 (JavaScript / TypeScript)

Oxlint is a Rust-based linter that is 50--100x faster than ESLint. Version 1.0 supports
400+ rules with plugin compatibility for many ESLint plugin rules.

```bash
npm install -D oxlint
npx oxlint src/
```

Configuration via `.oxlintrc.json`:

```json
{
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "typescript/no-explicit-any": "error",
    "react/no-direct-mutation-state": "error",
    "unicorn/prefer-node-protocol": "error",
    "import/no-cycle": "error"
  },
  "ignorePatterns": ["dist/", "*.gen.ts"]
}
```

Oxlint supports rules from these ESLint plugin namespaces:
`typescript`, `react`, `react-hooks`, `unicorn`, `import`, `jest`, `jsx-a11y`, `promise`, `nextjs`.

**Migration from ESLint:** Use Oxlint for fast feedback in pre-commit hooks and editors.
Keep ESLint for type-aware rules that require TypeScript project resolution. Run both:

```bash
# Pre-commit: fast Oxlint pass
npx oxlint src/

# CI: full ESLint with type-aware rules
npx eslint --max-warnings 0 src/
```

### Python: Ruff (0.8+)

Ruff replaces flake8, isort, black, pyflakes, pycodestyle, pydocstyle, and more in a single
Rust-based tool. It is 10--100x faster than the tools it replaces.

```toml
# pyproject.toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = [
  "E",    # pycodestyle errors
  "W",    # pycodestyle warnings
  "F",    # pyflakes
  "I",    # isort
  "N",    # pep8-naming
  "UP",   # pyupgrade
  "B",    # flake8-bugbear
  "SIM",  # flake8-simplify
  "S",    # flake8-bandit (security)
  "RUF",  # Ruff-specific rules
  "PT",   # flake8-pytest-style
  "TCH",  # flake8-type-checking
  "PERF", # Perflint
]
ignore = ["E501"]  # Line length handled by formatter

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["S101"]  # Allow assert in tests
"__init__.py" = ["F401"]     # Allow unused imports in __init__

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
docstring-code-format = true
```

```bash
ruff check .               # Lint
ruff check --fix .         # Lint with auto-fix
ruff format .              # Format (replaces black)
ruff check --select I --fix .  # Sort imports only
```

### Python: mypy vs pyright

| Aspect              | mypy                              | pyright                             |
|---------------------|-----------------------------------|-------------------------------------|
| Language            | Python                            | TypeScript (Node.js)                |
| Speed               | Slower (incremental helps)       | 3--5x faster on large codebases    |
| Strictness          | Gradual typing, configurable     | Strict by default                   |
| IDE integration     | Good (plugins)                   | Excellent (native in Pylance/VS Code) |
| Configuration       | `mypy.ini` or `pyproject.toml`   | `pyrightconfig.json` or `pyproject.toml` |
| Ecosystem           | De facto standard, wide adoption | Growing rapidly, Microsoft-backed   |

**mypy configuration:**

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
```

**pyright configuration:**

```json
{
  "typeCheckingMode": "strict",
  "pythonVersion": "3.12",
  "reportMissingTypeStubs": "warning",
  "reportUnusedImport": "error",
  "exclude": ["**/node_modules", "**/__pycache__", "dist"]
}
```

Use pyright for speed and IDE integration (VS Code Pylance). Use mypy when the codebase
already depends on mypy-specific plugins or requires gradual typing adoption.

### Go: golangci-lint

golangci-lint runs 100+ linters in parallel with deduplication and caching.

```yaml
# .golangci.yml
run:
  timeout: 5m
  go: "1.23"

linters:
  enable:
    - govet          # Go vet checks
    - staticcheck    # Advanced static analysis
    - errcheck       # Unchecked error returns
    - gosec          # Security checks
    - gofumpt        # Stricter gofmt
    - exhaustive     # Exhaustive enum switches
    - gocritic       # Opinionated code suggestions
    - revive         # Extensible linter (golint replacement)
    - prealloc       # Suggest preallocating slices
    - nolintlint     # Enforce nolint comment justifications

linters-settings:
  govet:
    enable-all: true
  gofumpt:
    extra-rules: true
  exhaustive:
    default-signifies-exhaustive: true
  gocritic:
    enabled-tags:
      - diagnostic
      - performance
      - style

issues:
  max-issues-per-linter: 0
  max-same-issues: 0
```

```bash
golangci-lint run ./...
golangci-lint run --fix ./...  # Auto-fix where supported
```

### Rust: Clippy

Clippy is the official Rust linter with lint groups for different strictness levels.

```toml
# Cargo.toml or clippy.toml
[lints.clippy]
all = "warn"
pedantic = "warn"
nursery = "warn"
cargo = "warn"
# Allow specific pedantic lints
module_name_repetitions = "allow"
must_use_candidate = "allow"
```

```bash
cargo clippy -- -D warnings            # Deny all warnings (CI)
cargo clippy --fix -- -D warnings      # Auto-fix
```

### CSS: Stylelint

```json
{
  "extends": ["stylelint-config-standard"],
  "plugins": ["stylelint-order"],
  "rules": {
    "order/properties-alphabetical-order": true,
    "selector-class-pattern": "^[a-z][a-zA-Z0-9]+$",
    "no-descending-specificity": true,
    "declaration-no-important": true
  }
}
```

### Additional Linters

| Tool            | Language     | Purpose                                    |
|-----------------|--------------|--------------------------------------------|
| **sqlfluff**    | SQL          | Lint and format SQL dialects               |
| **hadolint**    | Dockerfile   | Best practice checks for Dockerfiles       |
| **markdownlint**| Markdown    | Consistent Markdown formatting             |
| **shellcheck**  | Bash/Shell   | Static analysis for shell scripts          |
| **yamllint**    | YAML         | Syntax and formatting checks               |
| **actionlint**  | GitHub Actions | Lint workflow YAML files                 |

### Comparison Table

| Tool            | Language(s)   | Speed     | Rules | Formatter | Maturity   |
|-----------------|---------------|-----------|-------|-----------|------------|
| **ESLint v9**   | JS/TS         | Moderate  | 300+  | No        | Mature     |
| **Biome 2.0**   | JS/TS/CSS/JSON| Very Fast | 250+  | Yes       | Growing    |
| **Oxlint v1.0** | JS/TS         | Very Fast | 400+  | No        | Growing    |
| **Ruff 0.8+**   | Python        | Very Fast | 800+  | Yes       | Mature     |
| **golangci-lint**| Go           | Fast      | 100+  | Via gofumpt | Mature   |
| **Clippy**      | Rust          | Fast      | 650+  | No (rustfmt) | Mature  |
| **Stylelint**   | CSS/SCSS      | Moderate  | 170+  | No        | Mature     |

### Choosing the Right Tool (Decision Matrix)

```
Need type-aware TS rules?
  Yes -> ESLint v9 + typescript-eslint v8
  No  -> Is speed the priority?
           Yes -> Oxlint (lint only) or Biome (lint + format)
           No  -> ESLint v9 (largest plugin ecosystem)

Python project?
  -> Use Ruff for linting + formatting
  -> Add mypy or pyright for type checking

Go project?
  -> Use golangci-lint (single binary, runs all linters)

Rust project?
  -> Use Clippy + rustfmt

Multi-language monorepo?
  -> Use language-specific tools per package
  -> Orchestrate via pre-commit hooks or CI matrix
```

---

## Best Practices

1. **Use the fastest tool that meets your needs** -- Adopt Ruff for Python, Oxlint/Biome for JS/TS when the plugin ecosystem covers your rules.
2. **Combine fast linter + slow linter strategically** -- Run Oxlint in pre-commit hooks for instant feedback; run ESLint with type-aware rules in CI.
3. **Configure per `pyproject.toml` / `biome.json`** -- Keep linter config in the standard project config file, not scattered across dotfiles.
4. **Enable strict / recommended presets first** -- Start from the strictest preset and selectively disable rules rather than enabling rules one by one.
5. **Enforce `nolint` comment justifications** -- Use `nolintlint` (Go), `noqa` comments with codes (Python), or `eslint-disable` with reasons (JS/TS).
6. **Update linter versions quarterly** -- New rules catch new patterns. Pin exact versions to avoid surprise breaks; update deliberately.
7. **Run auto-fix in pre-commit, report-only in CI** -- Pre-commit hooks auto-fix trivial issues; CI reports the rest without mutating code.
8. **Type check separately from linting** -- Use mypy/pyright for Python and `tsc --noEmit` for TypeScript as separate CI steps.
9. **Measure performance impact** -- Profile linter execution time. If a single rule takes > 10% of total time, evaluate whether it provides proportional value.
10. **Standardize across the organization** -- Publish a shared config package for each language. Individual repos extend and override minimally.

---

## Anti-Patterns

| #  | Anti-Pattern                             | Problem                                                   | Fix                                                      |
|----|------------------------------------------|-----------------------------------------------------------|----------------------------------------------------------|
| 1  | Running 5 Python tools separately        | Slow, conflicting configurations, maintenance burden      | Replace with Ruff (single tool)                          |
| 2  | Ignoring type checking                   | Misses entire classes of bugs (null refs, type misuse)    | Add mypy/pyright (Python) or type-aware ESLint (TS)      |
| 3  | Using deprecated linters                 | TSLint, golint, flake8-only setups miss modern rules      | Migrate to ESLint, revive, Ruff respectively             |
| 4  | Same linter config for all file types    | Test files get production rules; scripts get library rules | Use per-file overrides and `files` scoping               |
| 5  | No auto-fix in development workflow      | Developers manually fix trivial formatting/import issues  | Enable `--fix` in pre-commit hooks and editor on-save    |
| 6  | Disabling rules without tracking         | Disabled rules accumulate, quality erodes silently        | Require justification comments; audit disables quarterly  |
| 7  | Running only in CI, not locally          | Developers discover issues minutes/hours after committing | Add pre-commit hooks and editor integration              |
| 8  | Linting generated or vendored code       | Unfixable noise, wasted CI time                           | Exclude generated/vendor paths in linter config          |

---

## Enforcement Checklist

- [ ] Each language in the project has a designated linter (ESLint/Biome/Oxlint for JS/TS, Ruff for Python, golangci-lint for Go)
- [ ] Linter config uses the strictest recommended preset as baseline
- [ ] Type checker enabled for typed languages (typescript-eslint, mypy/pyright)
- [ ] Auto-fix enabled in pre-commit hooks for all supported linters
- [ ] CI pipeline runs linters with zero-warning policy (`--max-warnings 0`, `-D warnings`)
- [ ] Generated, vendored, and build-output directories excluded from linting
- [ ] All `nolint` / `noqa` / `eslint-disable` comments include a justification
- [ ] Linter versions pinned in lockfile; updated on a quarterly schedule
- [ ] Shared linter config package published for organizational consistency
- [ ] Comparison audit performed when adopting new tooling (speed, rule coverage, ecosystem fit)
