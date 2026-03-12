# Pre-Commit Hooks (Shift-Left Quality Enforcement)

| Attribute    | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | Code Quality > Linting                                             |
| Importance   | High                                                               |
| Last Updated | 2026-03-11                                                         |
| Cross-ref    | [ESLint](eslint.md), [Prettier](prettier.md), [Language-Specific Linters](language-specific-linters.md) |

---

## Core Concepts

### Purpose

Pre-commit hooks enforce code quality at commit time, before code enters version control.
Shift-left: catch formatting, lint errors, type issues, and invalid commit messages
instantly, not minutes later in CI.

### Hook Types

| Hook Type       | Trigger                  | Typical Use                              |
|-----------------|--------------------------|------------------------------------------|
| `pre-commit`    | Before commit is created | Format, lint, type-check staged files    |
| `commit-msg`    | After message is entered | Validate conventional commit format      |
| `pre-push`      | Before push to remote    | Run tests, security scans               |
| `prepare-commit-msg` | Before editor opens | Inject ticket number from branch name   |

### Husky v9 Setup

Husky is the standard Git hooks manager for Node.js projects.

```bash
npm install -D husky
npx husky init           # Creates .husky/ directory and prepare script
```

This adds `"prepare": "husky"` to `package.json` scripts, which auto-installs hooks
when any developer runs `npm install`.

Create a pre-commit hook:

```bash
# .husky/pre-commit
npx lint-staged
```

Create a commit-msg hook:

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

### lint-staged

lint-staged runs linters only on Git-staged files, not the entire codebase.
This keeps pre-commit hooks fast regardless of project size.

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "prettier --write",
      "eslint --fix --max-warnings 0"
    ],
    "*.{js,mjs}": [
      "prettier --write",
      "eslint --fix --max-warnings 0"
    ],
    "*.{json,md,yaml,yml}": [
      "prettier --write"
    ],
    "*.css": [
      "prettier --write",
      "stylelint --fix"
    ],
    "*.py": [
      "ruff check --fix",
      "ruff format"
    ]
  }
}
```

Alternative configuration via `.lintstagedrc.mjs` for complex logic:

```js
// .lintstagedrc.mjs
export default {
  "*.{ts,tsx}": (filenames) => {
    const files = filenames.join(" ");
    return [
      `prettier --write ${files}`,
      `eslint --fix --max-warnings 0 ${files}`,
      // Run type-check on the entire project (not per-file)
      "tsc --noEmit --pretty",
    ];
  },
};
```

Run type-check on the full project (not per-file) because TypeScript needs the full
program context. Return it as a string (not using the `filenames` variable).

### pre-commit Framework (Python-based)

The `pre-commit` framework works for any language via a `.pre-commit-config.yaml` manifest.
Each hook runs in an isolated environment.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ["--maxkb=500"]
      - id: check-merge-conflict

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.6
    hooks:
      - id: ruff
        args: ["--fix"]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.14.0
    hooks:
      - id: mypy
        additional_dependencies: ["types-requests"]

  - repo: https://github.com/biomejs/pre-commit
    rev: v2.0.0
    hooks:
      - id: biome-check
        additional_dependencies: ["@biomejs/biome@2.0.0"]

  - repo: https://github.com/hadolint/hadolint
    rev: v2.12.0
    hooks:
      - id: hadolint

  - repo: https://github.com/golangci/golangci-lint
    rev: v1.62.0
    hooks:
      - id: golangci-lint
```

```bash
pip install pre-commit
pre-commit install              # Install Git hooks
pre-commit run --all-files      # Run all hooks on all files (first-time setup)
pre-commit autoupdate           # Update hook versions
```

### Conventional Commits Enforcement (commitlint)

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

```js
// commitlint.config.mjs
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor",
      "perf", "test", "build", "ci", "chore", "revert",
    ]],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};
```

Valid commit message format: `type(scope): description`

```
feat(auth): add OAuth2 PKCE flow
fix(api): handle null response from payment gateway
docs(readme): update deployment instructions
```

Wire to Husky:

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

### Common Hook Pipeline

Sequence for a TypeScript + React project:

```
pre-commit hook:
  1. lint-staged (parallel per glob):
     a. prettier --write  (format staged files)
     b. eslint --fix      (lint + auto-fix staged files)
  2. tsc --noEmit          (type-check full project)

commit-msg hook:
  3. commitlint --edit     (validate commit message)

pre-push hook:
  4. vitest run --changed  (test affected files only)
```

### Performance Optimization

| Technique                      | Impact                                    |
|--------------------------------|-------------------------------------------|
| lint-staged (only staged files)| 10--100x faster than linting full project |
| `--concurrent` flag            | Runs glob groups in parallel              |
| Cache (`eslint --cache`)       | Skips unchanged files                     |
| Skip hooks on CI               | CI runs its own checks; hooks are redundant |
| Use Oxlint for pre-commit      | 50--100x faster than ESLint for basic rules |

Detect CI and skip hooks:

```bash
# .husky/pre-commit
[ -n "$CI" ] && exit 0
npx lint-staged
```

### Lefthook (Husky Alternative)

Lefthook is a Go-based Git hooks manager with native parallel execution and more flexible
configuration.

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    prettier:
      glob: "*.{ts,tsx,js,mjs,json,md,yaml}"
      run: npx prettier --write {staged_files}
      stage_fixed: true
    eslint:
      glob: "*.{ts,tsx}"
      run: npx eslint --fix {staged_files}
      stage_fixed: true
    typecheck:
      run: npx tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx --no -- commitlint --edit {1}

pre-push:
  commands:
    test:
      run: npx vitest run --changed
```

```bash
npm install -D lefthook
npx lefthook install
```

**Lefthook vs Husky:**

| Aspect             | Husky v9            | Lefthook                    |
|--------------------|---------------------|-----------------------------|
| Language           | Shell scripts       | YAML config                 |
| Parallel execution | Via lint-staged     | Native `parallel: true`     |
| Auto-stage fixes   | Via lint-staged     | Native `stage_fixed: true`  |
| Monorepo support   | Manual setup        | Built-in `root` and `glob`  |
| Install method     | npm `prepare` script| npm `prepare` script        |
| Ecosystem          | Dominant in JS/TS   | Growing, language-agnostic  |

### Bypassing Hooks

Use `--no-verify` to skip hooks when absolutely necessary:

```bash
git commit --no-verify -m "wip: debugging session, will clean up"
```

Acceptable reasons to bypass:
- Work-in-progress commits on a feature branch (squash before merge).
- Emergency hotfix where hooks are broken.
- Committing generated files that intentionally fail lint.

Never bypass on `main`/`master`. Log bypasses in team communication for accountability.

### Team Onboarding (Auto-Install)

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

Every `npm install` / `pnpm install` triggers `prepare`, which installs hooks.
No manual setup required. New team members get hooks automatically.

For the `pre-commit` framework:

```yaml
# Makefile
.PHONY: setup
setup:
	pip install pre-commit
	pre-commit install
	pre-commit install --hook-type commit-msg
```

### Monorepo Hooks

For monorepos with Turborepo or Nx:

```json
// package.json (root)
{
  "lint-staged": {
    "packages/api/**/*.ts": [
      "npx turbo lint --filter=@acme/api"
    ],
    "packages/web/**/*.{ts,tsx}": [
      "npx turbo lint --filter=@acme/web"
    ],
    "*.{json,md,yaml}": [
      "prettier --write"
    ]
  }
}
```

Alternative: Use lint-staged per package and orchestrate from root:

```bash
# .husky/pre-commit
npx lint-staged --cwd packages/api
npx lint-staged --cwd packages/web
```

### Hook Failure Handling

Provide clear, actionable error messages. Auto-fix where possible:

```bash
# .husky/pre-commit
echo "Running pre-commit checks..."
npx lint-staged || {
  echo ""
  echo "Pre-commit checks failed."
  echo "Run 'npx lint-staged --debug' to see details."
  echo "Run 'npx prettier --write .' and 'npx eslint --fix src/' to auto-fix."
  echo "Use 'git commit --no-verify' to bypass (not recommended)."
  exit 1
}
```

---

## Best Practices

1. **Lint only staged files** -- Use lint-staged or lefthook's `{staged_files}` to keep hooks under 5 seconds.
2. **Auto-install hooks via `prepare` script** -- No manual setup for new developers. Hooks install on `npm install`.
3. **Enforce conventional commits** -- Use commitlint with `@commitlint/config-conventional` to enable automated changelogs and semantic versioning.
4. **Run type-check on the full project** -- TypeScript needs full program context. Do not type-check individual staged files.
5. **Skip hooks in CI** -- CI runs its own checks. Pre-commit hooks guard the developer workflow, not the pipeline.
6. **Auto-fix and re-stage** -- Configure lint-staged or lefthook to auto-fix issues and re-stage corrected files.
7. **Use `--no-verify` sparingly and transparently** -- Document acceptable bypass scenarios. Never bypass on protected branches.
8. **Provide actionable error messages** -- When hooks fail, tell the developer exactly how to fix the issue.
9. **Keep hooks fast** -- Target under 10 seconds total. Use Oxlint or Biome for the pre-commit pass; reserve ESLint type-aware rules for CI.
10. **Test hooks in CI** -- Run `npx lint-staged --diff="HEAD~1"` in CI to verify that the hook configuration itself is valid.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                   | Fix                                                      |
|----|---------------------------------------|-----------------------------------------------------------|----------------------------------------------------------|
| 1  | Linting entire codebase in pre-commit | 30+ second hooks; developers bypass with `--no-verify`    | Use lint-staged to lint only staged files                |
| 2  | No auto-install mechanism             | New developers forget to install hooks; unguarded commits | Add `"prepare": "husky"` to `package.json`               |
| 3  | Running tests in pre-commit           | Too slow for commit-time feedback                         | Move tests to `pre-push` or CI; run only affected tests  |
| 4  | No commit message validation          | Inconsistent history, broken changelog automation         | Add commitlint with `commit-msg` hook                    |
| 5  | Hooks that silently pass on error     | Broken hook scripts exit 0 on failure                     | Use `set -e` or explicit error handling in hook scripts  |
| 6  | Different checks locally vs CI        | Code passes hooks but fails CI (or vice versa)            | Align hook commands with CI commands; share configuration |
| 7  | Type-checking individual staged files | TypeScript cannot resolve cross-file types                | Type-check the full project (`tsc --noEmit`)             |
| 8  | No bypass documentation               | Developers bypass hooks without understanding consequences | Document when `--no-verify` is acceptable in CONTRIBUTING.md |

---

## Enforcement Checklist

- [ ] Git hooks installed via Husky `prepare` script or lefthook equivalent
- [ ] `pre-commit` hook runs lint-staged with format + lint for staged files
- [ ] `commit-msg` hook validates conventional commit format via commitlint
- [ ] `pre-push` hook runs affected tests (optional but recommended)
- [ ] lint-staged config covers all file types in the project (TS, JS, JSON, MD, CSS, Python)
- [ ] Type-check runs on the full project, not per-file
- [ ] Hooks complete in under 10 seconds for typical commits
- [ ] CI environment skips pre-commit hooks (`[ -n "$CI" ] && exit 0`)
- [ ] Hook failure messages include instructions for fixing and bypassing
- [ ] `.husky/` or `lefthook.yml` committed to version control
