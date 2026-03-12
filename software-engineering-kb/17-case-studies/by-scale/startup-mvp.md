# Engineering for Startup / MVP (0 to Product-Market Fit)

| Attribute    | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Domain       | Case Studies > By Scale                                      |
| Importance   | High                                                         |
| Last Updated | 2026-03-10                                                   |
| Cross-ref    | [Growing to 10K Users](growing-10k-users.md)                 |

---

## Core Concepts

### Stage-Appropriate Engineering Decisions

The pre-PMF stage optimizes for one metric: **speed of validated learning**. Every engineering decision serves the goal of shipping features fast, measuring user behavior, and iterating. Optimize for developer velocity, not theoretical scalability. Most startups die from building the wrong thing, not from technical limitations.

### Typical Parameters

- **Users**: 0 to ~1,000 early adopters
- **Team**: 1-5 engineers (often co-founders)
- **Timeline**: 3-18 months to PMF
- **Revenue**: Pre-revenue or early revenue
- **Primary risk**: Product risk (building the wrong thing), not technical risk

---

## Tech Stack Selection

### Optimize for Three Factors

1. **Speed of development** -- How fast can a single developer ship a feature end-to-end?
2. **Small team productivity** -- Does the stack minimize context-switching and boilerplate?
3. **Hiring pool** -- Can you find 2-3 more developers who know this stack?

### Recommended Stacks with Trade-offs

```
Stack: Next.js + Vercel + PostgreSQL
├── Strengths: Full-stack TypeScript, instant deploys, great DX, huge ecosystem
├── Weaknesses: SSR complexity, Vercel lock-in, cold starts on serverless
├── Best for: B2B SaaS, content-heavy apps, marketing sites with app
└── Hiring: Excellent (TypeScript is most popular language)

Stack: Ruby on Rails + Heroku/Render
├── Strengths: Convention over configuration, fastest prototyping, mature ecosystem
├── Weaknesses: Performance ceiling, smaller hiring pool, Ruby declining
├── Best for: CRUD-heavy apps, marketplaces, classic web apps
└── Hiring: Moderate (experienced devs available, fewer juniors)

Stack: Django + Railway/Render
├── Strengths: Batteries-included, great ORM, admin panel free, Python ecosystem
├── Weaknesses: Async support still maturing, monolithic defaults
├── Best for: Data-heavy apps, ML integration, APIs
└── Hiring: Good (Python is widely known)

Stack: Go + htmx + PostgreSQL
├── Strengths: Fast binaries, low memory, simple deployment, great performance
├── Weaknesses: More boilerplate, smaller web ecosystem, less productive for UI
├── Best for: Infrastructure tools, APIs, performance-sensitive backends
└── Hiring: Growing (smaller but high-quality pool)
```

### Stack Selection Decision

```
Choose based on team expertise FIRST:
  → Team knows TypeScript? → Next.js
  → Team knows Python?    → Django
  → Team knows Ruby?      → Rails
  → Team values performance + simplicity? → Go

Do NOT choose based on:
  × "What scales best" (irrelevant at 0 users)
  × "What Google/Netflix uses" (different problems)
  × "What's trending on Hacker News" (hype cycles)
```

---

## Architecture

### Start with a Monolith

```
Correct MVP Architecture:
┌─────────────────────────────────┐
│         Monolith App            │
│  ┌───────┐ ┌───────┐ ┌──────┐  │
│  │ Auth  │ │Billing│ │ Core │  │
│  │Module │ │Module │ │Logic │  │
│  └───────┘ └───────┘ └──────┘  │
│         Single Deploy           │
└────────────┬────────────────────┘
             │
        ┌────┴────┐
        │PostgreSQL│
        └─────────┘

Wrong MVP Architecture:
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│Auth  │  │Billing│  │Core  │  │Gateway│
│Svc   │──│Svc   │──│Svc   │──│      │
└──┬───┘  └──┬───┘  └──┬───┘  └──────┘
   │         │         │
┌──┴──┐  ┌──┴──┐  ┌──┴──┐  ┌───────┐
│DB 1 │  │DB 2 │  │DB 3 │  │Kafka  │
└─────┘  └─────┘  └─────┘  └───────┘
```

### Modular Monolith Principles

- Organize code by **domain/feature**, not by technical layer.
- Keep clear boundaries between modules (separate directories, defined interfaces).
- A module should be extractable to a service later if needed -- but do not extract now.

```typescript
// Good: Feature-based structure
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   └── auth.types.ts
│   ├── billing/
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   └── billing.types.ts
│   └── projects/
│       ├── projects.controller.ts
│       ├── projects.service.ts
│       └── projects.types.ts
├── shared/
│   ├── database.ts
│   ├── middleware.ts
│   └── config.ts
└── main.ts
```

---

## Database

### PostgreSQL for Everything

Use PostgreSQL as the single database. It handles relational data, JSON documents, full-text search, geospatial queries, and time-series data well enough for MVP scale.

```sql
-- Use JSONB for flexible schema during rapid iteration
CREATE TABLE features (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  config     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search without Elasticsearch
CREATE INDEX idx_features_search
  ON features USING GIN (to_tsvector('english', name));
```

### Avoid Multiple Databases

Do not add Redis, MongoDB, Elasticsearch, or other databases until PostgreSQL demonstrably cannot handle the workload. Each additional database adds operational burden that slows a small team.

---

## Infrastructure

### PaaS First, Kubernetes Never (at This Stage)

```
Deployment Complexity Ladder:
  ✓ Vercel / Netlify         → Static + serverless (simplest)
  ✓ Railway / Render / Fly   → Full apps with managed DB
  ✓ Heroku                   → Classic PaaS, higher cost
  ✗ AWS ECS / GCP Cloud Run  → Too much config for MVP
  ✗ Kubernetes               → Massive overhead, zero benefit at this scale
```

### Minimal Infrastructure Setup

```yaml
# Example: Railway or Render setup -- entire infra in one file
services:
  web:
    build: .
    envs:
      DATABASE_URL: ${{Postgres.DATABASE_URL}}
      REDIS_URL: ${{Redis.REDIS_URL}}  # Only if truly needed
    healthcheck: /health
    autoscaling:
      min: 1
      max: 3

  postgres:
    plugin: postgresql

  # That's it. No Terraform, no Helm charts, no VPCs.
```

---

## Testing Strategy

### Focus on High-Value Tests

```
MVP Test Priority:
  1. Integration tests for critical paths (signup, payment, core feature)
  2. E2E tests for the happy path (Playwright, 5-10 tests max)
  3. Unit tests for complex business logic only
  4. Skip: Unit tests for CRUD, controller tests, snapshot tests
```

```typescript
// High-value integration test -- test the actual flow
describe("User signup flow", () => {
  it("creates account, sends welcome email, initializes workspace", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "test@example.com", password: "secure123!" });

    expect(res.status).toBe(201);
    expect(res.body.user.workspaceId).toBeDefined();
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ template: "welcome" })
    );
  });
});
```

---

## Technical Debt

### Intentional Debt Is Acceptable

Document decisions with lightweight ADRs (Architecture Decision Records). A 5-line ADR in a `docs/decisions/` folder is sufficient.

```markdown
<!-- docs/decisions/003-skip-email-queue.md -->
# 003: Send Emails Synchronously

**Date**: 2026-01-15
**Status**: Accepted (revisit at 1K DAU)
**Decision**: Send emails in the request cycle, no background queue.
**Reason**: Simplicity. Adds ~200ms to signup but avoids Redis + worker setup.
**Revisit when**: Email volume > 1K/day or p99 latency matters.
```

---

## Team and Process

### Full-Stack Developers, Minimal Process

- Hire **generalists** who can work across the stack.
- Use pair programming for knowledge sharing (no bus factor of 1).
- Process: Daily standup (15 min), weekly retro (30 min). Nothing else.
- Ship speed: CI/CD from day 1, feature flags (LaunchDarkly free tier or PostHog).
- Use trunk-based development: merge to main multiple times per day.

```
Day 1 CI/CD Pipeline:
  push to main → lint + typecheck → run tests → deploy to production

Total time target: < 5 minutes
```

---

## 10 Key Lessons

1. **Ship the monolith.** A well-structured monolith is faster to develop, debug, and deploy than any distributed architecture. Extract services only when you have data proving the need.

2. **Choose boring technology.** PostgreSQL, a mainstream web framework, and a PaaS. Every "interesting" technology choice costs weeks of integration, debugging, and hiring difficulty.

3. **Optimize for iteration speed, not performance.** A feature that ships in 2 days and loads in 500ms beats a feature that ships in 2 weeks and loads in 50ms. Users at this stage tolerate slowness; they do not tolerate missing features.

4. **Use one language for everything.** TypeScript for frontend and backend, or Python for API and ML. Context-switching between languages costs more than any language-specific benefit at small scale.

5. **Buy, do not build.** Use Stripe for payments, Auth0/Clerk for auth, Resend for email, Cloudflare for CDN. Building these in-house wastes months that should go toward your core product.

6. **Deploy from day one.** Set up CI/CD before writing business logic. The first commit should deploy to a live URL. Feature flags enable shipping incomplete features safely.

7. **Document decisions, not code.** Code changes daily; ADRs capture why decisions were made. When the team grows, new engineers need context on trade-offs, not JSDoc on obvious functions.

8. **Skip premature testing infrastructure.** 20 well-chosen integration tests provide more confidence than 200 unit tests of getters and setters. Test the critical user journeys.

9. **Accept intentional technical debt.** Hard-code configuration, skip the abstraction layer, copy-paste instead of creating a library. Record the debt and move on. Refactor when the product stabilizes.

10. **Design for deletion, not extension.** Write code that is easy to throw away. Most MVP features will be rewritten or removed. Small, decoupled modules with clear boundaries make deletion safe.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Microservices at day one | 10x infrastructure complexity, 3x slower feature delivery | Start with modular monolith |
| Kubernetes before 10K users | Weeks spent on infra instead of product | Use PaaS (Vercel, Railway, Render) |
| Building auth from scratch | Security vulnerabilities, weeks of development | Use Clerk, Auth0, or Supabase Auth |
| Multiple databases (Postgres + Mongo + Redis + Elastic) | Operational overhead kills small team | PostgreSQL handles it all until proven otherwise |
| 90% unit test coverage mandate | Slows iteration, tests break on every refactor | Integration tests for critical paths only |
| Premature abstraction layers | Over-engineered code that is harder to change | Write concrete code, extract abstractions on the third use |
| Designing for 1M users at 0 users | Wastes months on problems that do not exist yet | Solve today's problems, document assumptions for tomorrow |
| Hiring specialists too early | Backend-only dev blocked waiting on frontend-only dev | Hire full-stack generalists |

---

## Checklist

- [ ] Single tech stack chosen based on team expertise, not hype
- [ ] Monolithic architecture with feature-based module organization
- [ ] PostgreSQL as the sole database
- [ ] PaaS deployment (zero infrastructure management)
- [ ] CI/CD pipeline deploying on every push to main (< 5 min)
- [ ] Feature flags enabled for safe incremental rollout
- [ ] Integration tests covering signup, payment, and core feature
- [ ] Lightweight ADRs documenting key technical decisions
- [ ] Third-party services for auth, payments, email, and analytics
- [ ] Trunk-based development with no long-lived branches
- [ ] Structured logging from day one (even if no monitoring dashboard yet)
- [ ] Error tracking enabled (Sentry free tier or equivalent)
- [ ] Weekly retrospective to identify what slows the team down
- [ ] No premature optimization -- performance budget deferred until 1K+ users
