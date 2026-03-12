# 11 — Testing

> Engineering confidence through automated verification at every layer of the stack.

## Structure (9 folders, 33 files)

### testing-philosophy/ (5 files)
- [testing-pyramid.md](testing-philosophy/testing-pyramid.md) — Pyramid, trophy, honeycomb, diamond models and when to use each
- [tdd.md](testing-philosophy/tdd.md) — Red-green-refactor, London vs Detroit school
- [bdd.md](testing-philosophy/bdd.md) — Given/When/Then, Cucumber, three amigos collaboration
- [what-to-test.md](testing-philosophy/what-to-test.md) — Risk-based testing, coverage strategy, test boundaries
- [shift-left-right.md](testing-philosophy/shift-left-right.md) — Pre-commit hooks, testing in production, dark launches

### unit-testing/ (4 files)
- [fundamentals.md](unit-testing/fundamentals.md) — FIRST principles, AAA pattern, boundary value analysis
- [mocking-strategies.md](unit-testing/mocking-strategies.md) — Test doubles (mock, stub, spy, fake, dummy), DI for testability
- [test-patterns.md](unit-testing/test-patterns.md) — Fixtures, factories (Fishery), builders, Object Mother
- [tools-jest-vitest-pytest.md](unit-testing/tools-jest-vitest-pytest.md) — Jest vs Vitest vs pytest vs Go testing, migration guide

### integration-testing/ (4 files)
- [api-testing.md](integration-testing/api-testing.md) — REST/GraphQL testing, Supertest, httptest, JSON Schema validation
- [database-testing.md](integration-testing/database-testing.md) — Transaction rollback, truncation, seeding, migration testing
- [service-testing.md](integration-testing/service-testing.md) — Component testing, MSW, WireMock, Docker Compose
- [test-containers.md](integration-testing/test-containers.md) — Testcontainers for PostgreSQL, Redis, Kafka across languages

### e2e-testing/ (5 files)
- [overview.md](e2e-testing/overview.md) — E2E strategy, critical path selection, Page Object Model
- [playwright.md](e2e-testing/playwright.md) — Cross-browser testing, auto-wait, tracing, CI integration
- [cypress.md](e2e-testing/cypress.md) — In-browser testing, custom commands, component testing
- [visual-regression.md](e2e-testing/visual-regression.md) — Percy, Chromatic, Playwright screenshots, baseline management
- [mobile-e2e.md](e2e-testing/mobile-e2e.md) — Detox, Maestro, Appium, device farms

### contract-testing/ (2 files)
- [api-contract-testing.md](contract-testing/api-contract-testing.md) — Consumer/provider/bi-directional contracts, Schemathesis
- [pact.md](contract-testing/pact.md) — Pact workflow, broker, matchers, message pact for async

### performance-testing/ (3 files)
- [load-testing.md](performance-testing/load-testing.md) — k6, Artillery, Locust, baselines, CI thresholds
- [stress-testing.md](performance-testing/stress-testing.md) — Stress, spike, soak testing, degradation analysis
- [chaos-engineering.md](performance-testing/chaos-engineering.md) — Gremlin, LitmusChaos, Toxiproxy, game days

### security-testing/ (3 files)
- [sast.md](security-testing/sast.md) — Semgrep, CodeQL, IDE integration, false positive management
- [dast.md](security-testing/dast.md) — OWASP ZAP, Nuclei, authenticated scanning, CI integration
- [dependency-scanning.md](security-testing/dependency-scanning.md) — Snyk, Dependabot, Renovate, license compliance, EPSS

### advanced-testing/ (3 files)
- [property-based-testing.md](advanced-testing/property-based-testing.md) — fast-check, Hypothesis, shrinking, property types
- [mutation-testing.md](advanced-testing/mutation-testing.md) — Stryker, mutmut, mutation score vs coverage
- [accessibility-testing.md](advanced-testing/accessibility-testing.md) — axe-core, WCAG 2.2, Lighthouse CI, EAA compliance

### test-automation/ (4 files)
- [ci-integration.md](test-automation/ci-integration.md) — Pipeline stages, sharding, selective execution, reporting
- [code-coverage.md](test-automation/code-coverage.md) — Line/branch/function coverage, ratcheting, diff coverage
- [flaky-tests.md](test-automation/flaky-tests.md) — Root causes, detection, quarantine strategy, metrics
- [test-data-management.md](test-automation/test-data-management.md) — Factories, seeders, PII masking, environment parity

## Cross-References

| Topic | Primary Location | Testing Perspective |
|-------|-----------------|-------------------|
| Backend test patterns | 06-backend/testing/ | Implementation-level testing patterns |
| Contract testing (backend) | 06-backend/testing/api-testing/contract-testing.md | Backend contract testing specifics |
| SAST (security depth) | 08-security/security-testing/sast.md | Security-focused SAST analysis |
| DAST (security depth) | 08-security/security-testing/dast.md | Security-focused DAST methodology |
| SCA / Supply chain | 08-security/dependency-and-supply-chain/ | Supply chain security perspective |
| Fuzz testing | 08-security/security-testing/fuzz-testing.md | Security fuzzing techniques |
| Load testing (perf) | 09-performance/benchmarking/load-testing.md | Performance engineering perspective |
| Stress testing (perf) | 09-performance/benchmarking/stress-testing.md | Performance engineering perspective |
| Circuit breaker testing | 10-scalability/patterns/circuit-breaker.md | Resilience pattern testing |
| SLI/SLO/SLA | 09-performance/performance-culture/sli-slo-sla.md | Performance targets |
