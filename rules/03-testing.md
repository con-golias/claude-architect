---
mode: auto
---

## Testing Strategy (Testing Pyramid)

### Test Ratio Target
- ~70% Unit tests: fast, isolated, test individual functions/classes
- ~20% Integration tests: test boundaries (DB, APIs, services together)
- ~10% E2E tests: critical user journeys only

### Unit Test Rules
- Co-locate with source file: user.service.ts → user.service.test.ts
- Test behavior, not implementation — test WHAT, not HOW
- One assertion per test when possible — test name describes expected behavior
- Use descriptive test names: "should return error when email is invalid"
- Mock external dependencies — never call real databases or APIs
- Test edge cases: null, undefined, empty strings, boundary values, error paths
- Test the unhappy path — error cases are more important than success cases

### Integration Test Rules
- Place in src/features/{feature}/__tests__/integration/
- Test real database interactions with test database
- Test API endpoint contracts (request → response)
- Use test fixtures and factories — never hardcode test data
- Reset state between tests — each test must be independent
- Test authorization: verify users cannot access others' resources

### E2E Test Rules
- Place in tests/e2e/
- Test ONLY critical business flows (registration, checkout, core features)
- Keep suite under 30 minutes — use parallel execution
- Use stable selectors (data-testid), never CSS classes or text content
- Handle flakiness: explicit waits, data isolation, deterministic state

### Test Quality Standards
- Every new feature: unit tests for use cases + integration test for API
- Every bug fix: write a failing test FIRST, then fix the bug
- Never mock what you don't own — create wrapper adapters instead
- Tests must be deterministic — no time-dependent or order-dependent tests
- Use factories/builders for test data — never share mutable test state
- Test file structure mirrors source structure

### Coverage Guidelines
- Minimum 80% line coverage for business logic (domain + application layers)
- 100% coverage for security-critical paths (auth, payment, data access)
- Do NOT chase coverage numbers on infrastructure/config code
- Focus on branch coverage over line coverage for conditionals

### Testing Naming Convention
- Files: {source-file}.test.{ext} or {source-file}.spec.{ext}
- Describe blocks: describe('ClassName/FunctionName', () => { ... })
- Test names: it('should [expected behavior] when [condition]')
