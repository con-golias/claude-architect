# Review Checklist

| Attribute      | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Domain         | Code Quality > Code Review                                           |
| Importance     | Critical                                                             |
| Last Updated   | 2026-03-11                                                           |
| Cross-ref      | [Best Practices](best-practices.md), [PR Templates](pr-templates.md) |

---

## Core Concepts

### Universal Review Checklist

Apply this checklist to every PR regardless of domain or size.

- [ ] **Intent is clear.** PR description explains *what* and *why*. Linked to an issue.
- [ ] **Scope is focused.** One logical change per PR. No unrelated refactoring bundled in.
- [ ] **Tests exist and are meaningful.** New behavior has tests. Bug fixes have regression tests.
- [ ] **No dead code.** Removed unused imports, variables, functions, and commented-out code.
- [ ] **Error handling is explicit.** No swallowed exceptions. Errors logged with context.
- [ ] **Naming is intention-revealing.** Variables, functions, and classes communicate purpose.
- [ ] **No hardcoded values.** Magic numbers and strings extracted to constants or configuration.
- [ ] **No secrets.** No API keys, passwords, tokens, or connection strings in code.
- [ ] **Backward compatible.** Or breaking changes are explicitly documented and versioned.
- [ ] **CI passes.** All status checks green before requesting review.

### Frontend Checklist

- [ ] **Accessibility (a11y).** Semantic HTML, ARIA labels, keyboard navigation, screen reader tested.
- [ ] **Responsive design.** Tested at mobile (375px), tablet (768px), and desktop (1440px) breakpoints.
- [ ] **Bundle size impact.** No new dependency added without justification. Tree-shaking verified.
- [ ] **Render performance.** No unnecessary re-renders. React: memo/useMemo/useCallback where measured.
- [ ] **Loading states.** Skeleton screens or spinners for async operations. Error boundaries in place.
- [ ] **Image optimization.** WebP/AVIF format, responsive srcset, lazy loading for below-fold images.
- [ ] **Cross-browser.** Tested in Chrome, Firefox, Safari. Polyfills for target browser matrix.
- [ ] **Internationalization (i18n).** No hardcoded strings. RTL layout considered if applicable.
- [ ] **SEO.** Meta tags, structured data, semantic headings. SSR/SSG for public pages.
- [ ] **Console clean.** No console.log, console.warn, or console.error in production code.

### Backend Checklist

- [ ] **Error handling.** All external calls wrapped in try/catch. Errors include context (request ID, user ID).
- [ ] **Logging.** Structured logging (JSON). Appropriate log levels (info for business events, error for failures).
- [ ] **Rate limiting.** Public endpoints have rate limits. Internal endpoints have circuit breakers.
- [ ] **Pagination.** List endpoints paginate. No unbounded queries. Default and max page sizes set.
- [ ] **Timeouts.** HTTP clients, database connections, and external service calls have explicit timeouts.
- [ ] **Idempotency.** Write operations are idempotent where applicable. Idempotency keys for payment flows.
- [ ] **Graceful shutdown.** Service handles SIGTERM. In-flight requests complete before exit.
- [ ] **Health checks.** Liveness and readiness endpoints present and correct.
- [ ] **Configuration.** No environment-specific values in code. Config from env vars or config service.
- [ ] **Resource cleanup.** Database connections, file handles, and temp files cleaned up (defer/finally/using).

### API Checklist

- [ ] **Backward compatibility.** No breaking changes to existing endpoints without version bump.
- [ ] **Versioning.** API versioned in URL (`/v2/`) or header. Deprecation timeline documented.
- [ ] **Request validation.** Input validated and sanitized at the API boundary. Schema validation (Zod, joi, pydantic).
- [ ] **Response format.** Consistent envelope (`{ data, error, meta }`). Appropriate HTTP status codes.
- [ ] **Documentation.** OpenAPI/Swagger spec updated. Examples included for new endpoints.
- [ ] **Authentication/Authorization.** Endpoints require auth. Permissions checked at handler level.
- [ ] **Error responses.** Machine-readable error codes. No stack traces in production responses.
- [ ] **Content negotiation.** Accept and Content-Type headers handled correctly.
- [ ] **CORS.** Allowed origins explicitly configured. No wildcard `*` in production.
- [ ] **Rate limiting.** Per-endpoint limits. Rate limit headers in responses (`X-RateLimit-*`).

### Database Checklist

- [ ] **Migrations reversible.** Every `up` migration has a corresponding `down`. Tested both directions.
- [ ] **Indexes.** New queries have supporting indexes. EXPLAIN plan reviewed for queries on large tables.
- [ ] **N+1 queries.** No loops executing individual queries. Use joins, eager loading, or batch fetching.
- [ ] **Transaction scope.** Transactions are as short as possible. No external API calls inside transactions.
- [ ] **Data types.** Appropriate types (UUID for IDs, timestamptz for dates, decimal for money).
- [ ] **Constraints.** NOT NULL, UNIQUE, FOREIGN KEY, CHECK constraints enforce data integrity at the DB level.
- [ ] **Soft delete.** If using soft delete, queries filter on `deleted_at IS NULL`. Indexes include the filter.
- [ ] **Large data handling.** Bulk inserts use batch operations. No `SELECT *` on wide tables.
- [ ] **Connection management.** Using connection pool. Pool size appropriate for deployment target.
- [ ] **Backward compatibility.** Schema changes support rolling deployments (expand-contract pattern).

### Security Checklist

- [ ] **Input validation.** All user input validated, sanitized, and parameterized. No string concatenation for queries.
- [ ] **Authentication.** Protected endpoints verify identity. Token validation is correct.
- [ ] **Authorization.** Resource access checks at the data layer, not just the route layer.
- [ ] **Secrets management.** No secrets in code, config files, or logs. Use vault or env injection.
- [ ] **Dependency vulnerabilities.** No known CVEs in dependencies (`npm audit`, `pip audit`, `govulncheck`).
- [ ] **OWASP Top 10.** Cross-reference against current OWASP Top 10 for the change type (Web, API, LLM).
- [ ] **Data exposure.** Sensitive fields (PII, credentials) not returned in API responses or logged.
- [ ] **HTTPS only.** No HTTP URLs for external calls. HSTS configured.
- [ ] **CSP/Headers.** Security headers set (CSP, X-Frame-Options, X-Content-Type-Options).
- [ ] **Audit trail.** Security-relevant actions (login, permission changes, data access) are logged.

See also: [08-security](../../08-security/) for comprehensive security reference.

### Performance Checklist

- [ ] **Algorithmic complexity.** No O(n^2) or worse in hot paths. Document expected input sizes.
- [ ] **Caching.** Frequently read, rarely written data cached. Cache invalidation strategy defined.
- [ ] **Query optimization.** Slow queries identified. EXPLAIN output reviewed. Indexes verified.
- [ ] **Lazy loading.** Large datasets loaded on demand. Pagination for list views.
- [ ] **Connection reuse.** HTTP keep-alive, database connection pooling, gRPC persistent connections.
- [ ] **Async where possible.** I/O-bound operations (email, notifications, logging) run asynchronously.
- [ ] **Memory allocation.** No memory leaks (event listeners removed, subscriptions unsubscribed, closures released).
- [ ] **Bundle/payload size.** API responses are minimal. Frontend bundles are code-split.
- [ ] **Concurrency.** Thread safety verified. No race conditions in shared state.
- [ ] **Benchmarks.** Performance-critical changes benchmarked before and after.

See also: [09-performance](../../09-performance/) for comprehensive performance reference.

### Architecture Checklist

- [ ] **Dependency direction.** Dependencies point inward (domain has no infrastructure imports).
- [ ] **Layer boundaries.** No business logic in controllers. No database queries in domain services.
- [ ] **SOLID principles.** Single responsibility. Open/closed. Interface segregation.
- [ ] **Coupling.** New dependencies between modules are justified. No circular dependencies.
- [ ] **Abstractions.** External services accessed through interfaces/ports, not concrete implementations.
- [ ] **Configuration.** Behavior differences handled via config, not conditionals per environment.
- [ ] **Consistency.** Follows existing patterns in the codebase. Deviations justified in PR description.
- [ ] **Extensibility.** New code can be extended without modifying existing code (plugin points, strategy pattern).

### Testing Checklist

- [ ] **Coverage.** New code has > 80% line coverage. Critical paths have > 95%.
- [ ] **Edge cases.** Null, empty, boundary values, invalid input, concurrent access tested.
- [ ] **Test readability.** Test names describe the scenario. AAA pattern (Arrange, Act, Assert) followed.
- [ ] **Test independence.** Tests do not depend on execution order or shared mutable state.
- [ ] **Test speed.** Unit tests run in < 5 seconds for the changed module. No unnecessary I/O.
- [ ] **Integration tests.** External service interactions have integration tests (Testcontainers, mocks with contracts).
- [ ] **Negative tests.** Error paths are tested, not just happy paths.
- [ ] **Flakiness.** New tests are deterministic. No time-dependent or order-dependent assertions.

See also: [11-testing](../../11-testing/) for comprehensive testing reference.

### Documentation Checklist

- [ ] **Public API docs.** New or changed endpoints documented in OpenAPI/Swagger.
- [ ] **Breaking changes noted.** CHANGELOG updated. Migration guide provided for breaking changes.
- [ ] **README updated.** New setup steps, environment variables, or dependencies documented.
- [ ] **Code comments.** Complex algorithms or non-obvious decisions have inline comments explaining *why*.
- [ ] **ADR created.** Significant architectural decisions documented in an Architecture Decision Record.

### Infrastructure Checklist

- [ ] **IaC review.** Terraform/Pulumi/CDK changes reviewed for blast radius. Plan output included in PR.
- [ ] **Blast radius.** Change affects only the intended resources. No accidental destruction of existing resources.
- [ ] **Cost impact.** New resources estimated for cost. No unbounded auto-scaling without limits.
- [ ] **Rollback plan.** Infrastructure changes can be reverted. State file considerations addressed.
- [ ] **Least privilege.** IAM roles and policies follow least privilege principle.
- [ ] **Monitoring.** New infrastructure has alerting configured. Dashboards updated.

### Checklist Automation with Danger.js

Automate checklist enforcement in CI. Danger.js reads the PR diff and enforces rules:

```typescript
// dangerfile.ts
import { danger, fail, warn, message } from "danger";

const modifiedFiles = danger.git.modified_files;
const createdFiles = danger.git.created_files;
const allFiles = [...modifiedFiles, ...createdFiles];

// Database: migration must have down
const migrations = allFiles.filter(f => f.includes("/migrations/"));
if (migrations.length > 0) {
  const migrationContent = migrations.map(f =>
    danger.git.diffForFile(f)
  );
  // Check for reversibility markers
  warn("Database migrations detected. Verify `down` migration exists and is tested.");
}

// API: OpenAPI spec must be updated when routes change
const routeFiles = allFiles.filter(f => f.includes("/routes/") || f.includes("/controllers/"));
const specFiles = allFiles.filter(f => f.includes("openapi") || f.includes("swagger"));
if (routeFiles.length > 0 && specFiles.length === 0) {
  warn("API routes changed but OpenAPI spec was not updated.");
}

// Security: flag auth and payment changes
const securityFiles = allFiles.filter(f =>
  f.includes("/auth/") || f.includes("/payment/") || f.includes("/security/")
);
if (securityFiles.length > 0) {
  message("Security-sensitive files changed. Ensure security team review.");
}

// Testing: new source files must have corresponding test files
const sourceFiles = createdFiles.filter(f =>
  (f.endsWith(".ts") || f.endsWith(".py") || f.endsWith(".go")) &&
  !f.includes("test") && !f.includes("spec") && !f.includes("__tests__")
);
for (const src of sourceFiles) {
  const testFile = src.replace(/\.(ts|py|go)$/, ".test.$1")
    .replace(".test.py", "_test.py")
    .replace(".test.go", "_test.go");
  const hasTest = allFiles.includes(testFile);
  if (!hasTest) {
    warn(`New file \`${src}\` does not have a corresponding test file.`);
  }
}

// Frontend: bundle size check
const packageJson = allFiles.find(f => f === "package.json");
if (packageJson) {
  warn("package.json changed. Verify bundle size impact.");
}

// Infrastructure: require plan output
const infraFiles = allFiles.filter(f =>
  f.endsWith(".tf") || f.includes("pulumi") || f.includes("cdk")
);
if (infraFiles.length > 0) {
  const prBody = danger.github.pr.body || "";
  if (!prBody.includes("terraform plan") && !prBody.includes("Plan:")) {
    fail("Infrastructure changes detected. Include `terraform plan` output in PR description.");
  }
}
```

### Review Checklist for AI-Generated Code

AI-assisted coding (Copilot, Cursor, Claude) requires additional scrutiny:

- [ ] **License compliance.** AI-generated code may reproduce licensed snippets. Run license scanning.
- [ ] **Hallucinated APIs.** Verify that all imported modules, functions, and methods actually exist.
- [ ] **Security blind spots.** AI models often omit input validation, auth checks, and error handling. Verify each.
- [ ] **Hardcoded secrets.** AI may generate placeholder credentials. Scan for `password`, `secret`, `api_key`, `token`.
- [ ] **Test quality.** AI-generated tests may assert implementation details, not behavior. Verify tests would fail if the logic broke.
- [ ] **Over-engineering.** AI tends to generate verbose solutions. Simplify where possible.
- [ ] **Context mismatch.** AI may generate code for a different framework version, language idiom, or project convention. Verify alignment.
- [ ] **Copy-paste coherence.** If the developer accepted multiple AI suggestions, verify they integrate coherently (no duplicate imports, conflicting patterns).
- [ ] **Documentation accuracy.** AI-generated comments may describe what the code *should* do, not what it *actually* does. Verify alignment.
- [ ] **Performance characteristics.** AI-generated algorithms may not be optimal. Check complexity.

---

## Best Practices

1. **Use the universal checklist on every PR.** Make it the minimum bar. Domain-specific checklists layer on top based on which files are changed.
2. **Automate checklist triggering.** Use Danger.js or GitHub Actions to activate domain-specific checklists based on file paths (e.g., `/migrations/` triggers database checklist).
3. **Keep checklists in the repository, not in a wiki.** Checklists evolve with the code. Store them as `.md` files or Danger.js rules version-controlled alongside the codebase.
4. **Apply the AI-generated code checklist whenever the PR is AI-assisted.** Add a label (`ai-assisted`) to trigger additional review steps. As AI coding tools proliferate, this becomes the default.
5. **Review tests before reviewing implementation.** Tests reveal the author's intent and edge case thinking. If the tests are wrong, the implementation review is wasted effort.
6. **Focus security checklist on the OWASP Top 10.** Do not attempt to check everything. Prioritize the most common vulnerability classes for the change type.
7. **Require infrastructure plan output in the PR.** Terraform/Pulumi plan output eliminates surprise resource changes. Never approve blind infrastructure changes.
8. **Update checklists when post-mortem reveals a gap.** Every production incident from a review miss should result in a new checklist item. Checklists are living documents.
9. **Do not mandate every checklist item on every PR.** Mark items as "N/A" when they do not apply. A 50-item checklist on a typo fix breeds checkbox fatigue.
10. **Pair automated checks with human judgment.** Automation catches the mechanical items (missing tests, missing docs). Humans verify design, business logic, and naming.

---

## Anti-Patterns

| Anti-Pattern                        | Problem                                                    | Fix                                                     |
|-------------------------------------|------------------------------------------------------------|---------------------------------------------------------|
| **Checkbox fatigue**                | 50-item checklist on every PR. Developers check all without reading. | Domain-specific checklists triggered by file path. N/A for irrelevant items. |
| **Checklist without automation**    | Manual enforcement is inconsistent and forgotten.          | Automate with Danger.js. CI fails on violations.        |
| **Static checklists**               | Checklist never updated. New vulnerability classes missed. | Update after every post-mortem. Quarterly review.       |
| **Checklist as substitute for review** | "All boxes checked, LGTM" without reading the code.    | Checklists supplement, not replace, human review.       |
| **Missing AI-code checklist**       | AI-generated code reviewed with same process as human code. | Add `ai-assisted` label. Trigger additional checks.     |
| **No infrastructure review**        | Terraform changes merged without plan review. Resources destroyed. | Require plan output in PR. Fail CI without it.       |
| **Security checklist on non-security PRs** | Every PR gets full OWASP review. Reviewer fatigue.  | Trigger security checklist only when auth/data/API files change. |
| **Test coverage as sole quality metric** | 95% coverage but tests assert nothing meaningful.    | Review test quality: behavior assertions, edge cases, negative paths. |

---

## Enforcement Checklist

- [ ] Universal review checklist documented in CONTRIBUTING.md
- [ ] Domain-specific checklists stored in repository (`.github/review-checklists/`)
- [ ] Danger.js (or equivalent) configured to enforce checklists in CI
- [ ] Domain checklists auto-triggered based on file paths changed
- [ ] AI-generated code label and checklist defined
- [ ] Infrastructure PRs require plan output (CI enforced)
- [ ] Security checklist references current OWASP Top 10
- [ ] Checklists reviewed and updated quarterly
- [ ] Post-mortem action items feed back into checklist updates
- [ ] Team trained on checklist purpose and proper use (not checkbox theater)
- [ ] "N/A" is an acceptable checklist response (prevents fatigue)
- [ ] Test-first review order documented in team guidelines
