# Writing Quality Code with AI

| Attribute      | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Code Quality > AI                                                    |
| Importance     | Critical                                                             |
| Last Updated   | 2026-03-11                                                           |
| Cross-ref      | [AI-Assisted Review](ai-assisted-review.md), [Coding Standards](../coding-standards/), [Quality Gates](../code-metrics/quality-gates.md) |

---

## Core Concepts

### AI as Coding Partner, Not Replacement

AI coding assistants augment developer capabilities -- they do not replace engineering judgment. Teams that achieve the best results treat AI as a junior pair programmer: fast at generating boilerplate, useful for exploring approaches, but requiring oversight on every output.

| AI Excels At                        | Humans Must Own                          |
|-------------------------------------|------------------------------------------|
| Boilerplate and scaffolding         | Architecture and system design           |
| Pattern completion and repetition   | Business logic and domain decisions      |
| Syntax and API usage recall         | Error handling strategy and edge cases   |
| Test case generation from examples  | Test design and coverage strategy        |
| Refactoring suggestions             | When and why to refactor                 |
| Documentation drafts                | Accuracy and completeness of docs        |

The rule: **AI-generated code receives the same review rigor as human-written code.** "The AI wrote it" is never an excuse for low quality. The developer who accepts and commits AI code owns that code.

### Prompt Engineering for Quality Code

The quality of AI output is directly proportional to the specificity of the input. Vague prompts produce generic, low-quality code.

**BAD prompt -- vague, no constraints:**

```
// BAD: "Write a function to process orders"
```

Produces generic code with no error handling, no types, no validation, and assumptions about data shape.

**GOOD prompt -- specific, constrained, contextual:**

```
// GOOD:
// Write a TypeScript function `processOrder` that:
// - Accepts an Order object (id: string, items: OrderItem[], customerId: string)
// - Validates that items is non-empty and all items have positive quantities
// - Calculates total with tax (rate from TaxService.getRate(customerId))
// - Throws OrderValidationError for invalid input
// - Throws PaymentProcessingError if payment fails
// - Returns ProcessedOrder with orderId, total, and timestamp
// - Uses the repository pattern consistent with src/services/
// - Include JSDoc with @throws annotations
```

**Prompt engineering principles for code quality:**

| Principle                      | What to Specify                                          |
|--------------------------------|----------------------------------------------------------|
| **Types first**                | Define interfaces and return types before implementation |
| **Error handling explicitly**  | Name the error types, specify what to throw and when     |
| **Constraints**                | Max complexity, performance requirements, dependencies   |
| **Project conventions**        | "Follow the pattern in `src/services/user.service.ts`"   |
| **Test expectations**          | "Include unit tests with edge cases for empty input"     |
| **Negative requirements**      | "Do NOT use any external dependencies"                   |

**Ask for types and interfaces first, then implementation:**

```typescript
// Step 1: Ask AI for the interface
// "Define TypeScript interfaces for an order processing system
//  with Order, OrderItem, ProcessedOrder, and error types"

interface OrderItem {
  productId: string;
  quantity: number;    // must be > 0
  unitPrice: number;   // in cents
}

interface Order {
  id: string;
  items: OrderItem[];
  customerId: string;
  createdAt: Date;
}

interface ProcessedOrder {
  orderId: string;
  total: number;       // in cents, includes tax
  tax: number;         // in cents
  processedAt: Date;
  paymentId: string;
}

class OrderValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

// Step 2: THEN ask for implementation referencing these types
// "Implement processOrder using the interfaces above.
//  Follow the service pattern in src/services/user.service.ts."
```

### Reviewing AI-Generated Code Checklist

Run this checklist on every piece of AI-generated code before committing:

```markdown
## AI Code Review Checklist

### Correctness
- [ ] Does it handle edge cases? (empty input, null, boundary values)
- [ ] Does it match the actual requirements, not just the prompt?
- [ ] Are all code paths reachable and tested?
- [ ] Does it handle concurrent access correctly (if applicable)?

### Error Handling
- [ ] Are all errors caught and handled appropriately?
- [ ] Do error messages include actionable context?
- [ ] Are errors propagated correctly (not swallowed silently)?
- [ ] Are external service failures handled with retries/fallbacks?

### Project Consistency
- [ ] Does it follow existing naming conventions?
- [ ] Does it use project dependencies (not introduce new ones)?
- [ ] Does it match the architecture pattern (layers, modules, DI)?
- [ ] Does the file structure match existing conventions?

### Quality
- [ ] Is it tested? (unit + integration where appropriate)
- [ ] Is it over-engineered for the requirement?
- [ ] Are there unnecessary abstractions or patterns?
- [ ] Is the complexity justified by the use case?

### Security
- [ ] Is user input validated and sanitized?
- [ ] Are there hardcoded secrets or credentials?
- [ ] Does it follow the principle of least privilege?
- [ ] Are SQL queries parameterized? Are outputs encoded?

### Dependencies
- [ ] Does it hallucinate APIs that don't exist?
- [ ] Are referenced libraries actually installed?
- [ ] Are the API signatures correct for the installed version?
- [ ] Does it use deprecated methods or patterns?
```

### Common AI Code Quality Issues

| Issue                          | Example                                            | Fix                                              |
|--------------------------------|----------------------------------------------------|--------------------------------------------------|
| **Over-abstraction**           | Factory-strategy-observer for a simple CRUD op     | Delete unnecessary layers. YAGNI.                |
| **Hallucinated APIs**          | `fs.readFileAsync()` (doesn't exist)               | Verify every API call against official docs.     |
| **Outdated patterns**          | Callbacks instead of async/await, `var` in TS      | Specify language version in prompt.              |
| **Missing error handling**     | No try-catch on async calls, no validation         | Always request error handling explicitly.        |
| **Unnecessary comments**       | `// increment i by 1` above `i++`                  | Delete comments that restate the code.           |
| **Wrong project style**        | camelCase in a snake_case Python project            | Provide style guide context in prompt.           |
| **Excessive dependencies**     | Adding `lodash` for a single array operation        | Specify "no new dependencies" in constraints.    |
| **Generic variable names**     | `data`, `result`, `temp`, `obj` everywhere          | Request domain-specific naming in prompt.        |
| **Copy-paste errors**          | Duplicated logic across generated functions          | Review for DRY violations. Extract shared code.  |
| **Ignoring project patterns**  | Raw SQL when project uses an ORM                    | Reference existing code: "follow UserRepository" |

### Maintaining Project Consistency with AI

Use context files to give AI assistants persistent knowledge of project conventions:

**CLAUDE.md (Claude Code):**

```markdown
# Project Context

## Build & Test
- `pnpm test` -- run all tests
- `pnpm test:integration` -- integration tests (requires Docker)
- `pnpm lint:fix` -- auto-fix lint issues

## Code Style
- Use ES modules with named exports
- 2-space indentation, single quotes, trailing commas
- Prefer `type` over `interface` unless extending
- Error classes extend `AppError` base class in `src/errors/`
- All services use constructor dependency injection

## Architecture
- Layered: Controller > Service > Repository > Model
- Controllers handle HTTP only -- no business logic
- Services contain business logic and orchestration
- Repositories handle database access via Prisma

## Naming
- Files: kebab-case (user-service.ts)
- Classes: PascalCase (UserService)
- Functions: camelCase (getUserById)
- Database tables: snake_case (user_profiles)

## Testing
- Co-locate tests: `user.service.ts` -> `user.service.test.ts`
- Use `vi.mock()` for module mocks, factory pattern for test data
- Integration tests use Testcontainers for Postgres
```

**Equivalent files for other tools:**

| Tool               | File                            | Purpose                           |
|--------------------|---------------------------------|-----------------------------------|
| Claude Code        | `CLAUDE.md`, `.claude/`         | Project context, memory, commands |
| Cursor             | `.cursor/rules/`                | Project rules per context         |
| GitHub Copilot     | `.github/copilot-instructions.md` | Repository-level instructions  |
| Windsurf           | `.windsurfrules`                | Project-specific rules            |
| Aider              | `.aider.conf.yml`              | Model, conventions, lint commands |
| Generic (emerging) | `AGENTS.md`                     | Cross-tool agent instructions     |

### AI Pair Programming Patterns

**Pattern 1: Plan, then implement, then review.**

```
Step 1 -- PLAN: "Outline the approach for adding rate limiting to the API.
          List the files to modify, the middleware design, and the Redis schema."

Step 2 -- IMPLEMENT: "Implement the rate limiting middleware following the plan.
          Use the existing middleware pattern in src/middleware/auth.ts."

Step 3 -- REVIEW: "Review the implementation for: error handling, race conditions,
          Redis connection failures, and edge cases with distributed rate counters."
```

**Pattern 2: Generate tests first, then implementation.**

```
Step 1: "Write tests for a UserService.updateEmail method that:
         - Validates email format, checks uniqueness, sends verification email
         - Throws on invalid email, duplicate email, and unverified user"

Step 2: "Implement UserService.updateEmail to pass all these tests.
         Follow the service pattern in src/services/auth.service.ts."
```

**Pattern 3: Incremental generation with checkpoints.**

```
Step 1: "Generate the data model and types."        -> Review and approve
Step 2: "Generate the repository layer."              -> Review and approve
Step 3: "Generate the service with business logic."   -> Review and approve
Step 4: "Generate the controller and routes."         -> Review and approve
Step 5: "Generate integration tests."                 -> Review and approve
```

Never generate an entire feature in a single prompt. Break into layers and review each before proceeding.

### Using AI for Refactoring

AI is effective at identifying and executing mechanical refactoring -- but humans must decide what and why.

**Safe AI refactoring workflow:**

```
1. GENERATE TESTS     "Write tests that capture the current behavior of UserService"
        |
2. VERIFY TESTS       Run tests. Confirm they pass against existing code.
        |
3. REQUEST REFACTOR   "Refactor UserService to use repository pattern.
                       All existing tests must continue to pass."
        |
4. RUN TESTS          Verify all tests still pass after refactoring.
        |
5. HUMAN REVIEW       Review the refactored code for readability and correctness.
```

Good refactoring prompts vs. bad:

```
// GOOD: "Extract the email validation logic from UserService.register,
//        UserService.updateEmail, and AuthService.resetPassword
//        into a shared EmailValidator utility class."

// BAD:  "Refactor this code to be better."
// BAD:  "Clean up the user module."
```

### Using AI for Documentation

AI generates solid first drafts. Humans must verify every `@param`, `@throws`, and `@example` -- AI often invents constraints, misses error cases, and writes examples that do not compile. Treat all AI-generated documentation as a draft requiring human sign-off.

### Measuring AI Code Quality

Track these metrics to ensure AI-assisted code maintains standards:

| Metric                          | How to Measure                                  | Warning Threshold          |
|---------------------------------|-------------------------------------------------|----------------------------|
| Post-merge defect rate (AI)     | Tag AI-assisted PRs. Track bugs within 30 days. | Higher than human-only PRs |
| Test coverage of AI code        | Coverage diff on AI-assisted PRs                | Below project minimum      |
| Cyclomatic complexity           | SonarQube / CodeClimate on AI-generated files   | Above team threshold       |
| Dependency additions            | Track new deps introduced by AI-assisted PRs    | Any unplanned addition     |
| Review cycle count              | Rounds of review before merge (AI-assisted PRs) | > 3 cycles                 |
| Hallucinated API rate           | CI failures from non-existent imports/methods   | Any occurrence             |
| Linter violations               | Lint errors in AI-generated code vs. human code | Higher than baseline       |

```python
# Example: Tag AI-assisted commits for tracking
# In your git workflow or PR template:

# .github/PULL_REQUEST_TEMPLATE.md addition:
# ## AI Assistance
# - [ ] This PR includes AI-generated code
# - AI tool used: _______________
# - Files with AI-generated code: _______________

# Query for metrics:
# gh pr list --label "ai-assisted" --json number,mergedAt \
#   --jq '.[] | select(.mergedAt != null)'
```

### AI-Friendly Codebase Design

Codebases with clear conventions produce better AI-generated code. Invest in these foundations:

| Foundation                  | Why It Helps AI                                      |
|-----------------------------|------------------------------------------------------|
| **Strong type system**      | AI generates correctly typed code when types exist   |
| **Consistent patterns**     | AI extrapolates from existing code more accurately   |
| **Small, focused files**    | AI context windows work better with focused modules  |
| **Named exports**           | AI autocomplete is more accurate with explicit names |
| **Descriptive naming**      | AI uses existing names to infer intent               |
| **Clear directory structure**| AI navigates and places new files correctly          |
| **Up-to-date dependencies** | AI suggests current APIs instead of deprecated ones  |

---

## Best Practices

1. **Apply identical review standards to AI and human code.** Do not lower the bar because AI generated it. Every line of AI code passes the same linting, testing, security, and review gates.
2. **Write specific, constrained prompts.** Define types, error handling, constraints, project patterns, and negative requirements in every prompt. Vague prompts produce vague code.
3. **Generate types and interfaces before implementation.** Ask AI for data models first, review and approve them, then request implementation. This prevents hallucinated data shapes.
4. **Break generation into incremental steps.** Never generate an entire feature in one prompt. Generate layer by layer (model, repository, service, controller, tests) and review each step.
5. **Maintain a CLAUDE.md or equivalent context file.** Document build commands, code style, architecture patterns, naming conventions, and testing approach. Update it as conventions evolve.
6. **Always request tests alongside code.** Prompt for tests in the same generation step or immediately after. AI code without tests is untested code, regardless of who wrote it.
7. **Verify every API and import against documentation.** AI hallucinates APIs, especially for newer libraries. Run the code. Check that every import resolves and every method signature matches.
8. **Generate tests before refactoring.** Capture existing behavior in tests, verify they pass, then request the refactoring. Run tests again after. Never refactor without a safety net.
9. **Tag AI-assisted PRs for quality tracking.** Add labels or PR template fields to identify AI-generated code. Track post-merge defect rates, coverage, and complexity by tag.
10. **Treat AI-generated documentation as a draft.** AI writes plausible-sounding but sometimes inaccurate documentation. Every `@param`, `@throws`, and `@example` must be verified by a human.

---

## Anti-Patterns

| Anti-Pattern                          | Problem                                                     | Fix                                                     |
|---------------------------------------|-------------------------------------------------------------|---------------------------------------------------------|
| **Copy-paste without understanding**  | Developer accepts AI output without reading it. Bugs, security holes, and incorrect logic ship to production. | Read every line. Explain the code to yourself before committing. |
| **Accepting the first suggestion**    | First AI output is rarely optimal. Accepting it wastes the opportunity for better alternatives. | Generate 2-3 approaches. Compare trade-offs. Pick the best fit. |
| **Disabling linters for AI code**     | AI code triggers lint errors, developer suppresses them instead of fixing. | Fix lint errors. If AI consistently violates a rule, add it to context file. |
| **No context file maintained**        | AI generates inconsistent code because it has no project knowledge. | Create and maintain CLAUDE.md / .cursor/rules / copilot-instructions.md. |
| **Generating entire features at once** | Large generation produces tangled, untestable code with hidden assumptions. | Break into layers. Generate, review, and approve incrementally. |
| **"AI wrote it" as quality excuse**   | Team lowers standards for AI code, treating it as verified. Technical debt accumulates. | Enforce: the committer owns the code regardless of who (or what) wrote it. |
| **Skipping tests for AI code**        | AI code appears correct on visual inspection but fails on edge cases. | Require tests for every AI-generated function. Run them before committing. |
| **Using AI without version context**  | AI suggests patterns from older language/framework versions. | Specify versions in prompt: "TypeScript 5.4", "React 19", "Python 3.12". |

---

## Enforcement Checklist

- [ ] CLAUDE.md (or equivalent context file) exists in every active repository and is reviewed quarterly
- [ ] PR template includes "AI Assistance" section to tag AI-generated code
- [ ] Same linting, testing, and coverage gates apply to AI and human code (no exceptions)
- [ ] AI code review checklist (edge cases, errors, tests, conventions, deps, security) is linked in PR template
- [ ] Team has documented prompt engineering guidelines with examples of good and bad prompts
- [ ] CI fails on hallucinated imports -- all imports resolve, all types compile
- [ ] Post-merge defect rate is tracked separately for AI-assisted PRs vs. human-only PRs
- [ ] Refactoring workflow enforced: tests first, then refactor, then re-run tests
- [ ] AI-generated documentation is reviewed for accuracy before merge (not auto-merged)
- [ ] Monthly review of AI code quality metrics (defect rate, coverage, complexity, linter violations)
- [ ] Developers trained on prompt engineering for code quality (onboarding checklist item)
- [ ] Context files updated when project conventions change (part of the convention-change PR)
