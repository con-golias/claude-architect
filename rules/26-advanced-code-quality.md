---
mode: auto
paths:
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.py"
  - "src/**/*.java"
  - "src/**/*.go"
---
## Advanced Code Quality

### Complexity Metrics
- Cyclomatic complexity per function MUST NOT exceed 10 — refactor into smaller functions above this
- Cognitive complexity per function MUST NOT exceed 15 — prioritize readability over cleverness
- Measure complexity with tooling: ESLint complexity rule, SonarQube, Radon (Python), gocyclo (Go)
- Enforce complexity limits in CI — fail the build on violations, not just warn
- When refactoring complex functions, extract by behavior not by line count:
  - Each extracted function should represent a single logical decision or transformation
  - Name extracted functions after WHAT they decide or compute, not WHERE they came from
- Review complexity trends per module over time — increasing complexity signals design problems

### Dead Code Elimination
- Remove unreachable code immediately — never leave it "for later"
- NEVER comment out code as a preservation strategy — use version control history
- Delete unused functions, classes, imports, variables, and types during every PR
- Use tooling to detect dead code: TypeScript `noUnusedLocals`/`noUnusedParameters`, `ts-prune`, `vulture` (Python), `deadcode` (Go)
- Remove unused feature flags and their associated code paths within 30 days of full rollout
- Remove unused dependencies when their consuming code is deleted — check with `depcheck` or equivalent
- Dead exports: if an exported symbol has zero importers outside its file, make it private or delete it

### Guard Clauses & Early Returns
- Use guard clauses to eliminate nesting — handle error/edge cases at the top of functions
- Each guard clause handles ONE condition and exits immediately (return, throw, continue)
  ```typescript
  // Good: guard clauses
  function processOrder(order: Order): Result {
    if (!order) throw new ValidationError("Order required");
    if (order.items.length === 0) return Result.empty();
    if (order.status !== "pending") return Result.skip("Not pending");
    // main logic at base indentation
  }
  ```
- Maximum nesting depth: 3 levels — any deeper requires extraction or guard clauses
- In loops, use `continue` for skip conditions and `break` for exit conditions at the top of the loop body
- NEVER use `else` after a guard clause that returns or throws — it adds unnecessary nesting

### Meaningful Naming
- Names MUST reveal intent — a reader should understand purpose without reading the implementation
- Avoid single-letter variables except: `i`/`j` for loop indices, `e` for caught errors, `_` for unused
- NEVER abbreviate unless the abbreviation is universally understood in the domain (e.g., `url`, `id`, `html`)
- Function names should read as actions: `calculateShippingCost`, not `shipping` or `doCalc`
- Boolean variables/functions answer a yes/no question: `isExpired()`, `hasPermission()`, `canRetry()`
- Rename immediately when meaning drifts — a misleading name is worse than a vague name
- Collection variables use plural nouns: `users`, `orderItems`, `pendingTasks`
- Avoid encoding type in name: `userList` -> `users`, `nameString` -> `name`

### Magic Number & String Elimination
- Extract ALL literal numbers into named constants — except `0`, `1`, `-1` in trivial contexts
- Name constants after business meaning, not value: `MAX_LOGIN_ATTEMPTS = 5`, not `FIVE = 5`
- Extract repeated string literals into constants or enums: status codes, error messages, config keys
- Use enums or union types for finite sets of related values — not raw strings
  ```typescript
  // Bad
  if (status === "active") { ... }
  // Good
  enum OrderStatus { Active = "active", Cancelled = "cancelled" }
  if (status === OrderStatus.Active) { ... }
  ```
- HTTP status codes in application code: use named constants (`HTTP_NOT_FOUND = 404`)
- Timeout/interval values: extract with unit in name: `SESSION_TIMEOUT_MS = 1800000`

### Code Duplication Management
- Run duplication detection in CI: `jscpd`, SonarQube, or language-specific tools
- Set maximum allowed duplication: 3% of codebase — alert above threshold
- Before extracting duplicated code, verify the duplications share the SAME reason to change
  - If they change for different reasons, duplication is acceptable (accidental vs essential)
- Extracted shared code goes to `src/shared/` — only when used by 3+ call sites
- Template method pattern for processes that share steps but vary in details
- NEVER create "utility grab bag" files — shared functions must be grouped by cohesive purpose
