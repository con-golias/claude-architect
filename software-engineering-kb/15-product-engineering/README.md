# 15 — Product Engineering

> Ship the right thing — agile methodologies, requirements engineering, team organization, estimation, product analytics, and technical decision frameworks.

## Structure (6 folders, 20 files)

### methodologies/ (4 files)
- [agile-scrum.md](methodologies/agile-scrum.md) — Scrum roles/events/artifacts, sprint mechanics, backlog prioritization (WSJF/MoSCoW/RICE), velocity, scaling (SAFe/LeSS/Nexus)
- [kanban.md](methodologies/kanban.md) — Kanban principles, WIP limits, lead/cycle time, throughput, CFD, classes of service, cadences
- [shape-up.md](methodologies/shape-up.md) — Appetite vs estimation, 6-week cycles, shaping/breadboarding, betting table, hill charts, scopes
- [comparison.md](methodologies/comparison.md) — Scrum vs Kanban vs Shape Up vs XP, decision matrix, hybrid approaches (Scrumban), migration strategies

### requirements/ (4 files)
- [gathering-requirements.md](requirements/gathering-requirements.md) — Discovery techniques, stakeholder analysis (RACI), JTBD, opportunity solution trees, PRDs, continuous discovery
- [user-stories.md](requirements/user-stories.md) — Story format, INVEST criteria, story splitting patterns, story mapping, walking skeleton, spike/enabler stories
- [acceptance-criteria.md](requirements/acceptance-criteria.md) — Given/When/Then (Gherkin), checklist style, Definition of Done/Ready, BDD automation (Cucumber/Playwright)
- [non-functional-requirements.md](requirements/non-functional-requirements.md) — ISO 25010, quantifying NFRs, architecture quality attributes, NFR trade-offs, testing NFRs

### team-organization/ (3 files)
- [team-topologies.md](team-organization/team-topologies.md) — Stream-aligned/enabling/platform/complicated-subsystem teams, interaction modes, cognitive load, Conway's Law
- [platform-teams.md](team-organization/platform-teams.md) — Internal Developer Platforms, golden paths, Backstage/Port/Cortex, platform as product, SPACE framework
- [engineering-culture.md](team-organization/engineering-culture.md) — DevEx (SPACE), onboarding 30-60-90, knowledge sharing, psychological safety, engineering ladder, remote-first

### estimation/ (3 files)
- [estimation-techniques.md](estimation/estimation-techniques.md) — Cone of uncertainty, T-shirt sizing, planning poker, PERT, Monte Carlo simulation, #NoEstimates
- [story-points.md](estimation/story-points.md) — Fibonacci scale, reference stories, velocity tracking, capacity planning, alternatives (cycle time, throughput)
- [managing-deadlines.md](estimation/managing-deadlines.md) — Scope negotiation (MoSCoW), risk registers, buffer planning, communicating delays, release trains, crunch prevention

### analytics-telemetry/ (3 files)
- [product-analytics.md](analytics-telemetry/product-analytics.md) — AARRR pirate metrics, event tracking architecture, PostHog/Amplitude SDKs, cohort/funnel analysis, privacy-first analytics
- [ab-testing.md](analytics-telemetry/ab-testing.md) — Statistical significance, sample size calculation, A/B/n/MVT/bandit, server-side assignment, experiment lifecycle, GrowthBook/Statsig
- [data-driven-development.md](analytics-telemetry/data-driven-development.md) — North Star metrics, OKRs, instrumentation strategy, dbt analytics engineering, ICE/RICE scoring, data pitfalls

### decision-frameworks/ (3 files)
- [rfc-process.md](decision-frameworks/rfc-process.md) — RFC template, lifecycle (draft to superseded), DACI framework, lightweight vs heavyweight, RFC vs ADR
- [technology-radar.md](decision-frameworks/technology-radar.md) — ThoughtWorks model (rings/quadrants), evaluation criteria, PoC methodology, technology lifecycle, governance
- [build-vs-buy.md](decision-frameworks/build-vs-buy.md) — TCO analysis, open-source evaluation (licenses), common decisions (auth/payments/CMS/search), migration strategies

## Cross-References

| Topic | This Section | Related Section |
|-------|-------------|----------------|
| Feature flags | — (removed, fully covered) | [12-devops/ci-cd/feature-flags.md](../12-devops-infrastructure/ci-cd/feature-flags.md) |
| BDD testing | requirements/acceptance-criteria.md | [11-testing/testing-philosophy/bdd.md](../11-testing/testing-philosophy/bdd.md) |
| SLI/SLO/SLA | requirements/non-functional-requirements.md | [09-performance/performance-culture/sli-slo-sla.md](../09-performance/performance-culture/sli-slo-sla.md) |
| Security requirements | requirements/non-functional-requirements.md | [08-security/foundations/security-by-design.md](../08-security/foundations/security-by-design.md) |
| Code review culture | team-organization/engineering-culture.md | [13-code-quality/code-review/culture.md](../13-code-quality/code-review/culture.md) |
| Tech debt prevention | decision-frameworks/technology-radar.md | [13-code-quality/technical-debt/prevention.md](../13-code-quality/technical-debt/prevention.md) |
| ADR process | decision-frameworks/rfc-process.md | [03-architecture/decision-records/](../03-architecture/decision-records/) |

## Perspective Differentiation

| Section | Focus |
|---------|-------|
| 01-fundamentals | Clean code principles, refactoring theory |
| 03-architecture | System design, architectural patterns, ADRs |
| 11-testing | Testing tools, frameworks, CI test integration |
| 12-devops | Pipeline implementation, deployment, feature flag tooling |
| 13-code-quality | Code enforcement, linting, metrics, AI-assisted review |
| **15-product-engineering** | **How to build the right thing — methodologies, requirements, team org, estimation, analytics, technical decisions** |
