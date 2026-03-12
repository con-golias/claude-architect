# Automated Refactoring (Codemods)

| Property       | Value                                                                |
|----------------|----------------------------------------------------------------------|
| Domain         | Code Quality > Refactoring                                           |
| Importance     | Medium                                                               |
| Audience       | Senior developers, platform teams, migration leads                   |
| Prerequisites  | AST concepts, language tooling, CI pipeline                          |
| Cross-ref      | [Safe Refactoring](safe-refactoring.md), [ESLint](../linting-formatting/eslint.md) |

---

## Core Concepts

### Codemods: Automated Code Transformations at AST Level

A codemod is a program that reads source code, parses it into an Abstract Syntax Tree (AST), applies transformations, and writes the modified code back. Unlike regex-based find-replace, codemods understand code structure.

```
Source code → Parse → AST → Transform → Generate → Modified code
```

**When to use codemods vs manual refactoring:**
- < 5 occurrences: Manual refactoring
- 5-10 occurrences: IDE multi-cursor or find-replace
- > 10 occurrences: Write a codemod
- > 100 occurrences across repos: Codemod + CI automation

### jscodeshift (JavaScript/TypeScript)

Facebook's toolkit for writing and running codemods on JavaScript and TypeScript codebases.

```typescript
// jscodeshift transform: rename deprecated API call
// Transform: analytics.track("event") → analytics.send({ event: "event" })
import type { API, FileInfo } from "jscodeshift";

export default function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "analytics" },
        property: { name: "track" },
      },
    })
    .forEach(path => {
      const args = path.node.arguments;
      if (args.length === 1 && args[0].type === "StringLiteral") {
        // Replace analytics.track("event") with analytics.send({ event: "event" })
        path.node.callee.property.name = "send";
        path.node.arguments = [
          j.objectExpression([
            j.objectProperty(j.identifier("event"), args[0]),
          ]),
        ];
      }
    });

  return root.toSource({ quote: "double" });
}
```

```bash
# Run jscodeshift transform across codebase
npx jscodeshift -t transforms/analytics-v2.ts src/ --extensions=ts,tsx --parser=tsx
# Dry run first
npx jscodeshift -t transforms/analytics-v2.ts src/ --dry --print
```

### ts-morph (TypeScript Compiler API Wrapper)

A higher-level API over the TypeScript compiler for programmatic code manipulation.

```typescript
import { Project, SyntaxKind } from "ts-morph";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

// Example: Add missing return types to all exported functions
for (const sourceFile of project.getSourceFiles()) {
  const functions = sourceFile.getFunctions().filter(f => f.isExported());

  for (const fn of functions) {
    if (!fn.getReturnTypeNode()) {
      const returnType = fn.getReturnType().getText(fn);
      fn.setReturnType(returnType);
    }
  }
}

// Example: Replace deprecated import with new one
for (const sourceFile of project.getSourceFiles()) {
  const imports = sourceFile.getImportDeclarations();
  for (const imp of imports) {
    if (imp.getModuleSpecifierValue() === "@old-lib/core") {
      imp.setModuleSpecifier("@new-lib/core");
      // Rename specific named imports
      for (const named of imp.getNamedImports()) {
        if (named.getName() === "OldComponent") {
          named.setName("NewComponent");
        }
      }
    }
  }
}

project.saveSync();
```

```typescript
// ts-morph: Find all functions exceeding complexity threshold
import { Project } from "ts-morph";

function analyzeComplexity(project: Project) {
  const report: { file: string; fn: string; branches: number }[] = [];

  for (const file of project.getSourceFiles()) {
    for (const fn of file.getFunctions()) {
      const branches = fn
        .getDescendantsOfKind(SyntaxKind.IfStatement).length
        + fn.getDescendantsOfKind(SyntaxKind.SwitchStatement).length
        + fn.getDescendantsOfKind(SyntaxKind.ConditionalExpression).length;

      if (branches > 10) {
        report.push({
          file: file.getFilePath(),
          fn: fn.getName() ?? "(anonymous)",
          branches,
        });
      }
    }
  }
  return report;
}
```

### Python: LibCST

LibCST provides a concrete syntax tree (preserving whitespace and comments) for Python code transformation.

```python
import libcst as cst
from libcst import matchers as m

class DeprecatedCallReplacer(cst.CSTTransformer):
    """Replace deprecated_function(x) with new_function(x, strict=True)."""

    def leave_Call(self, original_node, updated_node):
        if m.matches(updated_node.func, m.Name("deprecated_function")):
            new_args = list(updated_node.args) + [
                cst.Arg(
                    keyword=cst.Name("strict"),
                    value=cst.Name("True"),
                )
            ]
            return updated_node.with_changes(
                func=cst.Name("new_function"),
                args=new_args,
            )
        return updated_node

# Apply transform
source = open("module.py").read()
tree = cst.parse_module(source)
modified = tree.visit(DeprecatedCallReplacer())
print(modified.code)
```

```bash
# Run LibCST codemod across a package
python -m libcst.tool codemod my_transforms.DeprecatedCallReplacer src/
```

### Go: ast Package

Go's standard library includes AST manipulation tools.

```go
package main

import (
    "go/ast"
    "go/parser"
    "go/printer"
    "go/token"
    "os"
)

// Rename all instances of a function call
func main() {
    fset := token.NewFileSet()
    node, _ := parser.ParseFile(fset, "main.go", nil, parser.ParseComments)

    ast.Inspect(node, func(n ast.Node) bool {
        call, ok := n.(*ast.CallExpr)
        if !ok {
            return true
        }
        ident, ok := call.Fun.(*ast.Ident)
        if ok && ident.Name == "oldFunction" {
            ident.Name = "newFunction"
        }
        return true
    })

    printer.Fprint(os.Stdout, fset, node)
}
```

```bash
# Go also provides built-in refactoring tools
gorename -from '"mypackage".OldFunc' -to NewFunc
gomvpkg -from mypackage/old -to mypackage/new
```

### OpenRewrite for Java

Recipe-based refactoring for Java and JVM languages. Recipes are composable, reusable transformations.

```yaml
# rewrite.yml -- migrate from JUnit 4 to JUnit 5
type: specs.openrewrite.org/v1beta/recipe
name: com.example.JUnit5Migration
recipeList:
  - org.openrewrite.java.testing.junit5.JUnit4to5Migration
  - org.openrewrite.java.testing.junit5.UpdateBeforeAfterAnnotations
  - org.openrewrite.java.testing.junit5.AssertToAssertions
```

```bash
# Run OpenRewrite via Maven
mvn -U org.openrewrite.maven:rewrite-maven-plugin:run \
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-testing-frameworks \
  -Drewrite.activeRecipes=org.openrewrite.java.testing.junit5.JUnit4to5Migration
```

### Codemod Testing

Always test codemods with before/after fixture files.

```
transforms/
  __tests__/
    __fixtures__/
      analytics-v2/
        input.ts      # Before transformation
        output.ts     # Expected after transformation
    analytics-v2.test.ts
  analytics-v2.ts     # The transform
```

```typescript
// Transform test using jscodeshift test utilities
import { applyTransform } from "jscodeshift/dist/testUtils";
import transform from "../analytics-v2";

describe("analytics-v2 transform", () => {
  it("converts track() to send()", () => {
    const input = `analytics.track("pageView");`;
    const expected = `analytics.send({ event: "pageView" });`;
    const result = applyTransform(transform, {}, { source: input });
    expect(result).toBe(expected);
  });

  it("leaves non-analytics calls unchanged", () => {
    const input = `logger.track("something");`;
    const result = applyTransform(transform, {}, { source: input });
    expect(result).toBe(input);
  });
});
```

### Codemods in CI: Automated Migration PRs

```yaml
# .github/workflows/codemod-migration.yml
name: Automated Migration
on:
  workflow_dispatch:
    inputs:
      transform:
        description: "Transform to run"
        required: true

jobs:
  run-codemod:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx jscodeshift -t "transforms/${{ inputs.transform }}.ts" src/
      - run: npm test
      - uses: peter-evans/create-pull-request@v6
        with:
          title: "refactor: apply ${{ inputs.transform }} codemod"
          body: "Automated migration via codemod. Review changes carefully."
          branch: "codemod/${{ inputs.transform }}"
```

### Large-Scale Changes (Google's Approach)

For organizations with many repositories, the workflow is:

```
1. FIND    — Search across all repos for the pattern to change
2. FIX     — Run the codemod on each repo
3. REVIEW  — Generate PRs, assign to code owners
4. SUBMIT  — Merge after approval, track completion percentage
```

Tools: Google's internal Rosie, open-source alternatives include [Sourcegraph Batch Changes](https://sourcegraph.com) and [Turbolift](https://github.com/Skyscanner/turbolift).

```bash
# Sourcegraph batch change spec
name: update-logging-library
on:
  - repositoriesMatchingQuery: "lang:typescript logging-v1"
steps:
  - run: npx jscodeshift -t /transforms/logging-v2.ts src/
    container: node:20
changesetTemplate:
  title: "Migrate to logging-v2"
  body: "Automated migration from logging-v1 to logging-v2"
```

### AST-Based Search vs Regex

| Aspect            | Regex                        | AST-Based                        |
|-------------------|------------------------------|----------------------------------|
| Whitespace        | Must account for variations  | Ignores formatting               |
| Comments          | Can match inside comments    | Only matches code nodes          |
| Nested structures | Breaks on matching parens    | Handles nesting correctly        |
| Type awareness    | None                         | Can check types (ts-morph)       |
| Speed             | Fast                         | Slower (parse step required)     |
| Correctness       | Approximate                  | Precise                          |

---

## Best Practices

1. **Start with AST Explorer (astexplorer.net) to understand the tree structure.** Paste sample code, identify the node types you need to match, then write the transform.

2. **Always run codemods with --dry-run first.** Review the diff before writing changes to disk. Catch unexpected matches before they spread.

3. **Write fixture-based tests for every codemod.** Include edge cases: multiline expressions, nested calls, already-migrated code, and code that should not change.

4. **Preserve formatting with concrete syntax trees.** Use LibCST (Python) or recast (JavaScript) to maintain original whitespace, comments, and style.

5. **Run linter and formatter after codemod execution.** Codemods may produce valid but poorly formatted code. A post-pass with Prettier or Black normalizes style.

6. **Version control your codemods alongside the codebase.** Store transforms in a `codemods/` or `transforms/` directory. They serve as documentation of past migrations.

7. **Set the scale threshold at 10 occurrences.** Below 10, manual refactoring is faster than writing and testing a codemod. Above 10, the automation investment pays off.

8. **Chain small, focused transforms rather than writing one monolithic codemod.** Each transform does one thing: rename, update import, change argument. Compose them in sequence.

9. **Include a rollback plan for large-scale codemods.** Use a dedicated branch or batch of PRs so you can revert the entire migration if issues surface.

10. **Run the full test suite after codemod application, not just type checking.** AST transforms can produce type-correct but semantically wrong code (e.g., wrong argument order).

---

## Anti-Patterns

| Anti-Pattern                       | Problem                                          | Better Approach                         |
|------------------------------------|--------------------------------------------------|----------------------------------------|
| Regex-based refactoring at scale   | Matches inside strings/comments, misses variants | Use AST-based codemods                  |
| Untested codemod on production code| Silent bugs introduced across hundreds of files   | Write fixture tests, dry-run first      |
| One massive codemod PR             | Impossible to review, hard to bisect             | Split into batches of 20-50 files       |
| Codemod without formatter pass     | Inconsistent style after transformation          | Run Prettier/Black after codemod        |
| Writing codemod for 3 occurrences  | More time writing the tool than doing the work   | Manual refactoring under 10 occurrences |
| Ignoring partially matched code    | Codemod silently skips edge cases                | Log skipped files, handle all variants  |
| No type checking after transform   | Generated code may have type errors              | Run tsc/mypy/go vet after codemod       |
| Running codemod without tests first| No way to verify behavior preservation           | Ensure test suite passes before and after|

---

## Enforcement Checklist

- [ ] Codemods stored in version control under `codemods/` or `transforms/` directory
- [ ] Every codemod has fixture-based tests (input/output pairs) with edge cases
- [ ] Dry-run executed and diff reviewed before applying to codebase
- [ ] Full test suite passes after codemod application
- [ ] Linter and formatter run as post-processing step
- [ ] PR description includes: what changed, how many files affected, how to verify
- [ ] Codemods for deprecated API migrations include a CI check that blocks new usage
- [ ] Large-scale changes split into reviewable batches (max 50 files per PR)
- [ ] Scale threshold documented: codemods used only when > 10 occurrences
- [ ] Rollback strategy documented for multi-repo codemod campaigns
