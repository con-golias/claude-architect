# Prettier (Opinionated Code Formatter Deep Dive)

| Attribute    | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Domain       | Code Quality > Formatting                                          |
| Importance   | High                                                               |
| Last Updated | 2026-03-11                                                         |
| Cross-ref    | [ESLint](eslint.md), [Pre-commit Hooks](pre-commit-hooks.md)      |

---

## Core Concepts

### Philosophy

Prettier enforces a single, deterministic formatting style with minimal configuration.
The goal is to end all formatting debates. Accept the defaults; override only when the team has
a strong, documented reason. The fewer options configured, the better.

Prettier parses code into an AST, discards all original formatting, and reprints using its own
rules. This guarantees consistent output regardless of the input style.

### Configuration

Create `.prettierrc` (JSON) or `prettier.config.mjs` (ESM) in the project root.

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "proseWrap": "preserve"
}
```

**Options that matter:**

| Option          | Default | Recommended | Rationale                                              |
|-----------------|---------|-------------|--------------------------------------------------------|
| `printWidth`    | 80      | 80--120     | 80 for open source; 100--120 for private codebases     |
| `tabWidth`      | 2       | 2           | Standard for JS/TS ecosystems                          |
| `semi`          | `true`  | `true`      | Prevents ASI edge cases                                |
| `singleQuote`   | `false` | `true`      | Convention in JS/TS. HTML attributes stay double-quoted |
| `trailingComma` | `"all"` | `"all"`     | Cleaner diffs, easier reordering                       |
| `arrowParens`   | `"always"` | `"always"` | Consistent, avoids diff noise when adding params    |
| `endOfLine`     | `"lf"`  | `"lf"`      | Normalize line endings across OS                       |

### .prettierignore

```gitignore
# Build artifacts
dist/
build/
coverage/

# Generated files
*.gen.ts
*.generated.ts
pnpm-lock.yaml
package-lock.json

# Assets
*.svg
*.png
```

Mirror patterns from `.gitignore` where appropriate. Prettier reads `.gitignore` by default
(v3+), so most ignore patterns are inherited automatically.

### Prettier + ESLint Integration

**Problem:** ESLint and Prettier may have overlapping formatting rules that conflict.

**Solution:** Use `eslint-config-prettier` to disable all ESLint rules that conflict with Prettier.

```js
// eslint.config.mjs
import prettier from "eslint-config-prettier";

export default [
  // ... other configs
  prettier, // MUST be last
];
```

**Running order:**
1. ESLint checks code quality (logic, correctness, best practices).
2. Prettier formats code (whitespace, line breaks, punctuation).

Do NOT use `eslint-plugin-prettier` (runs Prettier as an ESLint rule). It is slower,
produces noisy red squiggles on formatting issues, and conflates linting with formatting.

### Prettier Plugins

| Plugin                              | Purpose                                  |
|-------------------------------------|------------------------------------------|
| `prettier-plugin-tailwindcss`       | Sort Tailwind CSS classes automatically  |
| `prettier-plugin-organize-imports`  | Sort and remove unused imports           |
| `prettier-plugin-sql`              | Format SQL queries in template literals   |
| `prettier-plugin-prisma`           | Format Prisma schema files                |
| `prettier-plugin-packagejson`      | Sort `package.json` fields consistently   |
| `prettier-plugin-sh`              | Format shell scripts                       |

Install and register plugins:

```json
{
  "plugins": [
    "prettier-plugin-tailwindcss",
    "prettier-plugin-organize-imports"
  ]
}
```

Plugin load order matters. Place `prettier-plugin-tailwindcss` last because it needs to see
the final import/class structure after other plugins run.

### Editor Integration

**VS Code (`settings.json`):**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.formatOnPaste": false,
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[markdown]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[css]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
}
```

Commit `.vscode/settings.json` to the repository so every team member gets format-on-save
without manual setup. Alternatively, use `.vscode/settings.json` with recommended extensions.

**JetBrains (WebStorm/IntelliJ):**
Enable under `Settings > Languages & Frameworks > Prettier`. Check "On save" and "On reformat code".

### CI Enforcement

```yaml
# .github/workflows/format.yml
jobs:
  prettier:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: "npm" }
      - run: npm ci
      - run: npx prettier --check .
```

`--check` exits with code 1 if any file is not formatted. Use in CI to block unformatted code.
`--write` mutates files in place. Use in pre-commit hooks or local development.

### Handling Prettier Conflicts

Use `prettier-ignore` for code where formatting harms readability:

```typescript
// prettier-ignore
const matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
```

For Markdown:

```markdown
<!-- prettier-ignore-start -->
| Complex | Table  | Layout |
|---------|--------|--------|
| Keep    | This   | Exact  |
<!-- prettier-ignore-end -->
```

Use `prettier-ignore` sparingly. Every ignore comment should have a reason in a nearby comment.

### Prettier vs Biome Formatting

| Aspect               | Prettier                          | Biome                              |
|----------------------|-----------------------------------|------------------------------------|
| Speed                | ~1s for 1000 files               | ~50ms for 1000 files (20x faster) |
| Language support     | JS/TS, CSS, HTML, MD, YAML, etc. | JS/TS, JSON, CSS, GraphQL         |
| Plugin ecosystem     | Extensive (Tailwind, SQL, etc.)  | Growing, not yet at parity        |
| Configuration        | Minimal by design                | Minimal, similar philosophy        |
| AST fidelity         | Gold standard                    | Near-identical output              |

Choose Biome when the project is JS/TS-only and speed matters. Choose Prettier when the
project includes Markdown, YAML, HTML, or depends on Prettier-specific plugins.

### Prettier for Non-JS Languages

Prettier formats many languages out of the box:

| Language   | Key Behavior                                      |
|------------|---------------------------------------------------|
| **CSS**    | Sorts properties (with plugin), normalizes values |
| **HTML**   | Preserves attribute formatting, wraps long lines  |
| **Markdown** | Wraps prose, normalizes list markers            |
| **YAML**   | Normalizes quoting and indentation                |
| **GraphQL** | Formats schema and query files                  |
| **JSON**   | Consistent indentation, trailing newline          |

### Migration Strategy

Format the entire codebase in a single commit. Do NOT format incrementally.

```bash
# Step 1: Install Prettier
npm install -D prettier

# Step 2: Create .prettierrc with team-agreed options

# Step 3: Format everything
npx prettier --write .

# Step 4: Commit as a single "format codebase" commit
git add -A && git commit -m "chore: format entire codebase with Prettier"

# Step 5: Configure git blame to ignore the formatting commit
echo "<commit-hash>" >> .git-blame-ignore-revs
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

Use `.git-blame-ignore-revs` so that `git blame` skips the mass-formatting commit.
This preserves meaningful blame history.

---

## Best Practices

1. **Accept defaults** -- Override only `printWidth`, `singleQuote`, and `trailingComma`. Document the reason for every override.
2. **Format on save in the editor** -- Configure VS Code / JetBrains to format on save. Developers should never manually run the formatter.
3. **Use `--check` in CI** -- Block merges when formatting drifts. Never rely solely on pre-commit hooks.
4. **Use `eslint-config-prettier`, not `eslint-plugin-prettier`** -- Disable conflicting ESLint rules rather than running Prettier as an ESLint rule.
5. **Format the entire codebase in one commit** -- Incremental formatting creates noisy diffs and merge conflicts on every touched file.
6. **Add `.git-blame-ignore-revs`** -- Exclude the mass-formatting commit from `git blame` output.
7. **Keep `.prettierignore` minimal** -- Prettier reads `.gitignore` by default. Only add patterns for files that are tracked but should not be formatted (lockfiles, generated code).
8. **Place Tailwind plugin last** -- `prettier-plugin-tailwindcss` depends on the final AST state after other plugins.
9. **Pin Prettier version** -- Different versions may produce different output. Pin the exact version in `package.json` to avoid CI/local formatting drift.
10. **Use `prettier-ignore` with a reason** -- Every ignore comment must be accompanied by a code comment explaining why formatting was suppressed.

---

## Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                  | Fix                                                      |
|----|---------------------------------------|----------------------------------------------------------|----------------------------------------------------------|
| 1  | Hundreds of Prettier options          | Defeats the "opinionated" philosophy; creates bike-shedding | Accept defaults. Override at most 3--5 options          |
| 2  | Using `eslint-plugin-prettier`        | Slow, noisy red squiggles, conflates linting with formatting | Use `eslint-config-prettier` to disable conflicting rules |
| 3  | Incremental formatting adoption       | Noisy diffs, merge conflicts, inconsistent style          | Format entire codebase in a single commit                |
| 4  | Missing `.git-blame-ignore-revs`      | `git blame` shows the formatting commit as author of every line | Create the ignore-revs file immediately after mass-format |
| 5  | No CI `--check` step                  | Unformatted code merges when developers forget pre-commit hooks | Add `prettier --check .` to CI pipeline                 |
| 6  | Different Prettier versions locally and in CI | Format output differs, causing phantom changes      | Pin exact version in `package.json`, use lockfile         |
| 7  | Excessive `prettier-ignore` comments  | Undermines consistent formatting; creates maintenance burden | Reserve for matrices, ASCII art, or complex alignment    |
| 8  | Formatting generated/vendor files     | Wastes time, may break generated code                     | Add generated and vendor paths to `.prettierignore`      |

---

## Enforcement Checklist

- [ ] `.prettierrc` exists with team-agreed options (max 3--5 overrides)
- [ ] `.prettierignore` excludes build artifacts, lockfiles, and generated code
- [ ] `eslint-config-prettier` is the last entry in the ESLint flat config array
- [ ] Editor format-on-save configured in committed `.vscode/settings.json`
- [ ] CI pipeline runs `npx prettier --check .` and blocks on failure
- [ ] Pre-commit hook runs `prettier --write` on staged files via lint-staged
- [ ] Prettier version pinned to exact version in `package.json`
- [ ] `.git-blame-ignore-revs` created with the mass-formatting commit hash
- [ ] Prettier plugins installed and ordered correctly (Tailwind last)
- [ ] Team has run `npx prettier --write .` and committed the single formatting commit
