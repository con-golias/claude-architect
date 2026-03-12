# ESLint (v9 Flat Config Deep Dive)

| Attribute    | Value                                                                                          |
|--------------|------------------------------------------------------------------------------------------------|
| Domain       | Code Quality > Linting                                                                         |
| Importance   | Critical                                                                                       |
| Last Updated | 2026-03-11                                                                                     |
| Cross-ref    | [Prettier](prettier.md), [Language-Specific Linters](language-specific-linters.md), [Pre-commit Hooks](pre-commit-hooks.md) |

---

## Core Concepts

### Flat Config (eslint.config.js / mjs / ts)

ESLint v9 uses **flat config** as the only supported format. The legacy `.eslintrc.*` format is removed.
Flat config exports an array of config objects. Each object applies to files matching its scope.

```js
// eslint.config.mjs
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    rules: {
      "no-console": "warn",
    },
  },
];
```

Key differences from legacy format:

| Legacy (.eslintrc)         | Flat Config (eslint.config.mjs)       |
|----------------------------|---------------------------------------|
| `extends` array            | Spread configs into the array         |
| `env: { browser: true }`  | `languageOptions.globals`             |
| `parser` string            | `languageOptions.parser` (imported)   |
| `parserOptions`            | `languageOptions.parserOptions`       |
| `.eslintignore` file       | `ignores` array in config object      |
| Cascading configs          | Explicit array ordering               |

### Config Object Structure

```js
{
  name: "my-config",               // Optional descriptive name for debugging
  files: ["**/*.ts", "**/*.tsx"],   // Glob patterns this config applies to
  ignores: ["dist/", "coverage/"], // Glob patterns to exclude
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parser: tsParser,              // Imported parser object
    parserOptions: {
      projectService: true,        // typescript-eslint v8 project service
      tsconfigRootDir: import.meta.dirname,
    },
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  plugins: {
    "@typescript-eslint": tsPlugin, // Key = prefix, value = imported plugin
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  settings: {},                    // Shared settings for plugins
}
```

### Migration from .eslintrc to Flat Config

Use the official migration tool:

```bash
npx @eslint/migrate-config .eslintrc.json
```

Manual migration steps:
1. Replace `extends` with imported configs spread into the array.
2. Replace `env` with `languageOptions.globals` using the `globals` package.
3. Replace string `parser` with an imported parser module.
4. Move `.eslintignore` content into a config object with only `ignores`.
5. Replace `overrides` with separate config objects scoped via `files`.

### TypeScript Integration (typescript-eslint v8)

```js
// eslint.config.mjs
import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
```

`projectService: true` replaces the legacy `project: "./tsconfig.json"` approach.
It automatically resolves the correct tsconfig for each file, improving monorepo support.

Type-aware rules catch bugs that plain syntax rules miss:

| Rule                                    | What It Catches                       |
|-----------------------------------------|---------------------------------------|
| `@typescript-eslint/no-floating-promises` | Unhandled promise rejections         |
| `@typescript-eslint/no-misused-promises` | Passing promises where void expected |
| `@typescript-eslint/await-thenable`     | Awaiting non-thenable values          |
| `@typescript-eslint/no-unsafe-assignment` | `any` type leaking into typed code  |
| `@typescript-eslint/strict-boolean-expressions` | Truthy checks on non-boolean types |

### Essential Plugins

| Plugin                      | Purpose                              | Flat Config Import                     |
|-----------------------------|--------------------------------------|----------------------------------------|
| `eslint-plugin-import-x`   | Import order, no unresolved imports  | `import importX from "eslint-plugin-import-x"` |
| `eslint-plugin-unicorn`    | Modern JS idioms, best practices     | `import unicorn from "eslint-plugin-unicorn"` |
| `eslint-plugin-promise`    | Promise best practices               | `import promise from "eslint-plugin-promise"` |
| `eslint-plugin-jsx-a11y`   | React accessibility checks           | `import jsxA11y from "eslint-plugin-jsx-a11y"` |
| `eslint-plugin-react-hooks`| Hook dependency and rules of hooks   | `import reactHooks from "eslint-plugin-react-hooks"` |
| `eslint-plugin-testing-library` | Enforce testing-library best practices | `import testingLibrary from "eslint-plugin-testing-library"` |

### Complete Flat Config -- TypeScript + React Project

```js
// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importX from "eslint-plugin-import-x";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores (standalone object with only ignores)
  { ignores: ["dist/", "coverage/", "*.gen.ts", "vite.config.ts.timestamp-*"] },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript type-checked
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  // Project-wide settings
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
  },

  // React + JSX
  {
    files: ["src/**/*.tsx"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-no-target-blank": "error",
      "jsx-a11y/alt-text": "error",
    },
    settings: { react: { version: "detect" } },
  },

  // Import ordering
  {
    plugins: { "import-x": importX },
    rules: {
      "import-x/order": ["error", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      }],
      "import-x/no-duplicates": "error",
    },
  },

  // Unicorn modern JS
  {
    plugins: { unicorn },
    rules: {
      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/prefer-top-level-await": "error",
    },
  },

  // Disable type-checked for JS files
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Prettier must be LAST to override formatting rules
  prettier,
);
```

### Custom Rule Writing

```js
// rules/no-hardcoded-url.js
export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow hardcoded HTTP URLs in source code" },
    fixable: "code",
    schema: [{ type: "object", properties: { allowLocalhost: { type: "boolean" } } }],
    messages: {
      noHardcodedUrl: "Use environment variable or config instead of hardcoded URL '{{url}}'.",
    },
  },
  create(context) {
    const allowLocalhost = context.options[0]?.allowLocalhost ?? false;

    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!/^https?:\/\//.test(node.value)) return;
        if (allowLocalhost && /localhost|127\.0\.0\.1/.test(node.value)) return;

        context.report({
          node,
          messageId: "noHardcodedUrl",
          data: { url: node.value },
        });
      },
    };
  },
};
```

Register the custom rule as a local plugin:

```js
// eslint.config.mjs
import noHardcodedUrl from "./rules/no-hardcoded-url.js";

export default [
  {
    plugins: {
      local: { rules: { "no-hardcoded-url": noHardcodedUrl } },
    },
    rules: { "local/no-hardcoded-url": ["error", { allowLocalhost: true }] },
  },
];
```

### Shareable Configs

Create a reusable config package:

```js
// packages/eslint-config-acme/index.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  prettier,
);
```

Consume in a project:

```js
import acme from "@acme/eslint-config";
export default [...acme, { rules: { /* project overrides */ } }];
```

### Performance Optimization

```bash
# Measure per-rule timing
TIMING=1 npx eslint src/

# Use cache to skip unchanged files
npx eslint --cache --cache-location node_modules/.cache/eslint/ src/

# Target specific directories (avoid linting node_modules, dist, etc.)
npx eslint src/ tests/
```

### ESLint Disable Comments

Use `eslint-disable-next-line` with a reason. Never leave unexplained disables:

```typescript
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- API returns untyped JSON
const data = await response.json();
```

Never disable an entire file without justification. Prefer targeted disables over broad ones.
Audit existing disables periodically -- stale disables hide real issues.

### Monorepo Setup

```js
// eslint.config.mjs (root)
import baseConfig from "./packages/eslint-config/index.mjs";

export default [
  ...baseConfig,
  // Package-specific overrides
  {
    files: ["packages/api/**/*.ts"],
    rules: { "no-console": "off" },  // Server-side logging OK
  },
  {
    files: ["packages/web/**/*.tsx"],
    rules: { "jsx-a11y/anchor-is-valid": "error" },
  },
];
```

### CI Integration

```yaml
# .github/workflows/lint.yml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: "npm" }
      - run: npm ci
      - run: npx eslint --max-warnings 0 src/
      # SARIF output for GitHub Code Scanning
      - run: npx eslint -f @microsoft/eslint-formatter-sarif -o results.sarif src/ || true
      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: results.sarif }
```

`--max-warnings 0` fails CI on any warning, enforcing a zero-warning policy.

---

## Best Practices

1. **Adopt flat config immediately** -- Legacy `.eslintrc` is removed in v9. Do not start new projects on the old format.
2. **Enable type-aware rules for TypeScript** -- Use `projectService: true` with `strictTypeChecked` to catch floating promises, unsafe `any`, and type misuse.
3. **Place Prettier config last** -- `eslint-config-prettier` must be the last entry in the config array to disable conflicting formatting rules.
4. **Use `--max-warnings 0` in CI** -- Treat every warning as a blocking issue. Warnings that are perpetually ignored become invisible tech debt.
5. **Cache lint results** -- Use `--cache` with a `.cache` directory in `node_modules` to skip unchanged files and accelerate CI.
6. **Scope configs with `files` globs** -- Apply test-specific rules only to test files. Apply React rules only to `.tsx` files.
7. **Require reasons on disable comments** -- Enforce `eslint-disable-next-line` with a `--` comment explaining why. Consider `eslint-plugin-eslint-comments` for enforcement.
8. **Publish a shareable config for your org** -- Centralize rule decisions. Individual repos extend the base and override only when justified.
9. **Measure rule performance** -- Run `TIMING=1` periodically. Disable or replace rules that take > 5% of total lint time.
10. **Integrate SARIF output with GitHub Code Scanning** -- Surface lint findings inline on pull requests, not just in CI logs.

---

## Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                    | Fix                                                       |
|----|-------------------------------------|------------------------------------------------------------|-----------------------------------------------------------|
| 1  | Blanket `eslint-disable` at file top | Silences every rule for the entire file                   | Use targeted `eslint-disable-next-line` with a reason     |
| 2  | Warnings instead of errors          | Warnings accumulate and are universally ignored            | Use `error` severity. Reserve `warn` for active migration |
| 3  | Disabling rules instead of fixing code | Hides real bugs behind disable comments                 | Fix the underlying issue; disable only with documented justification |
| 4  | Linting generated code              | Wastes time, produces unfixable noise                      | Add generated paths to `ignores`                          |
| 5  | Outdated shareable config           | Stale rules miss new language features and patterns        | Pin to semver range, update quarterly, track changelog     |
| 6  | No `files` scoping                  | Test rules applied to production code or vice versa        | Always scope plugin configs with `files` globs            |
| 7  | Skipping type-aware rules for speed | Misses the highest-value TypeScript checks                 | Use `projectService`, enable caching, lint targeted dirs  |
| 8  | Running ESLint + Prettier separately without coordination | Conflicting formatting rules cause oscillating fixes | Use `eslint-config-prettier` as the last config entry     |

---

## Enforcement Checklist

- [ ] Project uses `eslint.config.mjs` (flat config) with no legacy `.eslintrc` files present
- [ ] `typescript-eslint` v8 with `projectService: true` and `strictTypeChecked` enabled
- [ ] `eslint-config-prettier` is the last entry in the config array
- [ ] `--max-warnings 0` flag set in CI pipeline
- [ ] `--cache` flag enabled for local development and CI
- [ ] SARIF output configured for GitHub Code Scanning (or equivalent PR integration)
- [ ] All `eslint-disable` comments include a justification reason
- [ ] Generated files, `dist/`, `node_modules/`, and `coverage/` are in the `ignores` array
- [ ] Shareable org config published and consumed by all team repositories
- [ ] `TIMING=1` audit performed within the last quarter to identify slow rules
