# Engineering at 10K Users (Early Growth)

| Attribute    | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Domain       | Case Studies > By Scale                                      |
| Importance   | High                                                         |
| Last Updated | 2026-03-10                                                   |
| Cross-ref    | [Startup MVP](startup-mvp.md), [Scaling to 1M](scaling-1m-users.md) |

---

## Core Concepts

### Stage-Appropriate Engineering Decisions

At 10K users the product has early traction. Engineering shifts from "ship anything fast" to "ship fast without breaking things." The first real scaling pain surfaces: slow queries, memory leaks, flaky deploys. The team grows from a handful of co-founders to 5-15 engineers who did not write the original code. Process, observability, and quality gates become essential -- but keep them lightweight.

### Typical Parameters

- **Users**: 1K-10K active users (DAU), growing 10-20% month-over-month
- **Team**: 5-15 engineers, first non-founding hires
- **Revenue**: Early revenue, Series A or approaching it
- **Infrastructure cost**: $500-$5,000/month
- **Primary risk**: Execution risk (can we grow without imploding?)

---

## First Scaling Issues

### Recognizing the Symptoms

```
Symptom                        → Root Cause                → First Fix
─────────────────────────────────────────────────────────────────────────
API response > 500ms           → N+1 queries, missing idx  → Query optimization
Occasional 502 errors          → Memory leaks, cold starts → Connection pooling, profiling
Deploys cause 30s downtime     → No zero-downtime deploy   → Rolling deploys, health checks
Background jobs pile up        → Sync processing in req    → Add job queue (Sidekiq/BullMQ)
Users report stale data        → No caching layer          → Add Redis for hot paths
Search is slow                 → LIKE queries on large set → PostgreSQL FTS or add index
```

### Performance Triage Approach

```typescript
// Step 1: Add request timing middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const duration = performance.now() - start;
    logger.info({
      method: req.method,
      path: req.route?.path ?? req.path,
      status: res.statusCode,
      duration_ms: Math.round(duration),
      query_count: req.queryCount ?? 0,  // Track DB queries per request
    });
    if (duration > 500) {
      logger.warn({ path: req.path, duration_ms: duration }, "Slow request");
    }
  });
  next();
});
```

---

## Architecture Evolution

### Add Caching, Background Jobs, CDN

```
MVP Architecture (before):          10K Architecture (after):
┌──────────────┐                   ┌──────────────┐
│   Monolith   │                   │   Monolith   │──→ CDN (static assets)
└──────┬───────┘                   └──┬────┬──────┘
       │                              │    │
  ┌────┴────┐                    ┌────┴┐ ┌─┴────┐
  │PostgreSQL│                   │ PG  │ │Redis │ (cache + sessions)
  └─────────┘                   └──┬──┘ └──────┘
                                   │
                              ┌────┴─────────┐
                              │ Job Queue    │ (emails, webhooks,
                              │ (BullMQ/     │  image processing)
                              │  Sidekiq)    │
                              └──────────────┘
```

### Caching Strategy at This Scale

```typescript
// Cache expensive queries with short TTL
async function getProjectDashboard(projectId: string) {
  const cacheKey = `dashboard:${projectId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const dashboard = await db.query(`
    SELECT p.*,
           COUNT(DISTINCT t.id) AS task_count,
           COUNT(DISTINCT m.id) AS member_count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    LEFT JOIN memberships m ON m.project_id = p.id
    WHERE p.id = $1
    GROUP BY p.id
  `, [projectId]);

  await redis.setex(cacheKey, 60, JSON.stringify(dashboard)); // 60s TTL
  return dashboard;
}
```

---

## Database Optimization

### Query Fixes That Matter Most

```sql
-- 1. Fix N+1 queries: Use JOINs or batch loading
-- Before (N+1): 1 query for users + N queries for their projects
-- After (JOIN): 1 query total
SELECT u.*, p.id AS project_id, p.name AS project_name
FROM users u
LEFT JOIN project_memberships pm ON pm.user_id = u.id
LEFT JOIN projects p ON p.id = pm.project_id
WHERE u.organization_id = $1;

-- 2. Add missing indexes (check slow query log first)
CREATE INDEX CONCURRENTLY idx_tasks_project_status
  ON tasks (project_id, status) WHERE deleted_at IS NULL;

-- 3. Connection pooling: Use PgBouncer or built-in pool
-- Configure pool size = (2 * CPU cores) + effective_spindle_count
-- For a 2-core PaaS instance: pool_size = 5-10
```

### Read Replicas (When Needed)

Add a read replica when analytics queries or dashboards compete with transactional writes. Route read-heavy endpoints to the replica.

```typescript
// Simple read/write split
const writeDb = new Pool({ connectionString: process.env.DATABASE_URL });
const readDb = new Pool({ connectionString: process.env.DATABASE_REPLICA_URL });

// Use readDb for dashboards, reports, search
// Use writeDb for mutations
```

---

## Observability

### The Three Pillars at This Stage

```
Priority 1: Error Tracking (Sentry)
  → Know when things break before users report them
  → Set up Slack alerts for new error types
  → Group errors, assign owners, track resolution

Priority 2: Structured Logging (Datadog/Grafana Cloud)
  → JSON logs with request_id, user_id, duration
  → Query logs to debug production issues
  → Set up log-based alerts for error rate spikes

Priority 3: Metrics (Application + Infrastructure)
  → Request latency (p50, p95, p99)
  → Error rate (5xx / total requests)
  → Database query duration and connection pool usage
  → Memory and CPU utilization
```

```typescript
// Structured logging -- always include context
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Per-request child logger with correlation ID
app.use((req, res, next) => {
  req.log = logger.child({
    requestId: req.headers["x-request-id"] ?? crypto.randomUUID(),
    userId: req.user?.id,
    path: req.path,
  });
  next();
});
```

---

## Team Growth (5-15 Engineers)

### Code Review Becomes Essential

```
Code Review Guidelines at This Stage:
  1. Every PR requires 1 approval (not 2 -- keep velocity)
  2. Max PR size: 400 lines (split larger changes)
  3. Review within 4 hours during business hours
  4. Use PR templates with checklist (tests? migration? rollback?)
  5. Automate style enforcement (linters, formatters) -- do not review formatting
```

### Onboarding and Documentation

```
Minimum Documentation Set:
  ├── README.md              → Setup in < 30 minutes
  ├── docs/
  │   ├── architecture.md    → System overview with diagram
  │   ├── decisions/         → ADRs (from MVP stage, keep adding)
  │   ├── runbooks/          → How to deploy, rollback, debug common issues
  │   └── onboarding.md      → First week guide for new engineers
  └── CONTRIBUTING.md        → PR process, code style, testing expectations
```

---

## Process

### Lightweight Kanban or Short Sprints

- Use 1-week sprints or continuous Kanban (not 2-week sprints -- too slow for this stage).
- Sprint planning: 30 minutes, prioritize by user impact.
- Retrospectives: biweekly, focused on removing bottlenecks.
- Avoid: story points, velocity tracking, extensive Jira workflows.

### Introduce Quality Gates

```yaml
# CI Pipeline at 10K users
on: [push]
jobs:
  quality:
    steps:
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: npx playwright test  # E2E for critical paths
      - name: Coverage gate
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "Coverage below 60%: $COVERAGE"
            exit 1
          fi
```

---

## Technical Debt Paydown

### First Scheduled Refactoring

Dedicate 15-20% of each sprint to tech debt. Track debt items alongside features.

```
Debt Prioritization Matrix:
  High Impact + Low Effort   → Fix this sprint
  High Impact + High Effort  → Schedule as a project
  Low Impact + Low Effort    → Fix when touching that code
  Low Impact + High Effort   → Ignore (document and move on)
```

### Common Debt Items at This Stage

- Extract hardcoded config into environment variables.
- Replace raw SQL with query builder or ORM for common patterns.
- Add database migrations for schema changes (no more manual ALTER TABLE).
- Consolidate error handling (consistent error responses).
- Replace copy-pasted code with shared utilities.

---

## Security Basics

### OWASP Top 10 Minimum

```
Security Checklist for 10K Users:
  ✓ HTTPS everywhere (enforce via HSTS)
  ✓ Parameterized queries (no string concatenation in SQL)
  ✓ CSRF protection on all state-changing endpoints
  ✓ Rate limiting on auth endpoints (5 attempts per minute)
  ✓ Secrets in environment variables, not in code
  ✓ Dependency scanning (Dependabot / Snyk free tier)
  ✓ Content Security Policy headers
  ✓ Input validation on all user inputs (zod / joi)
```

---

## Cost Awareness

### First Real Cloud Bills

```
Typical 10K-User Monthly Costs:
  PaaS hosting (Render/Railway):  $50-200
  Database (managed PostgreSQL):  $50-150
  Redis (managed):                $15-50
  CDN (Cloudflare free tier):     $0
  Error tracking (Sentry):        $26-80
  Monitoring (Grafana Cloud):     $0-50 (free tier generous)
  Email (Resend/SendGrid):        $0-20
  ──────────────────────────────────────
  Total:                          $150-550/month

  Optimization opportunities:
  → Rightsize database instance (check CPU usage -- often < 20%)
  → Cache aggressively (reduce DB load, not instance size)
  → Use CDN for all static assets (offload bandwidth)
  → Review unused services monthly
```

---

## 10 Key Lessons

1. **Add observability before scaling.** Instrument the application with structured logging, error tracking, and basic metrics before adding caching or replicas. Diagnose the actual bottleneck; do not guess.

2. **Fix the database queries first.** 90% of "scaling problems" at 10K users are slow queries. Add missing indexes, fix N+1 patterns, and enable the slow query log before adding infrastructure.

3. **Introduce code review -- but keep it lightweight.** One reviewer, 4-hour SLA, automated formatting. Code review builds shared understanding as the team grows beyond the founding engineers.

4. **Start paying down technical debt on a schedule.** Allocate 15-20% of capacity to debt. The shortcuts from the MVP stage compound if ignored. Track debt items visibly alongside features.

5. **Add a caching layer for read-heavy paths.** Redis with short TTLs (30-120 seconds) eliminates most database pressure. Cache dashboard data, user profiles, and configuration -- invalidate on writes.

6. **Move slow operations to background jobs.** Email sending, webhook delivery, image processing, and report generation belong in a job queue. Keep request-response cycles under 200ms.

7. **Document how to operate the system.** Write runbooks for deployment, rollback, and debugging common issues. When the on-call engineer at 2 AM is a recent hire, runbooks save the company.

8. **Establish CI/CD quality gates.** Lint, typecheck, test, and coverage checks on every push. Catch regressions before they reach production. Invest 1 day in CI; save weeks of debugging.

9. **Implement basic security before a breach forces you to.** OWASP top 10 mitigations, dependency scanning, and secrets management are non-negotiable. A security incident at this stage can kill the company.

10. **Track infrastructure costs from the start.** Set up billing alerts, review monthly, right-size instances. Costs grow faster than revenue if unmanaged. Build the habit of cost-aware engineering now.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Ignoring slow queries until the database falls over | Cascading failures, user-facing outages | Enable slow query log, fix top 5 queries weekly |
| No monitoring -- relying on user reports for errors | Hours of undetected downtime | Sentry + uptime monitor on day one of this stage |
| Skipping code review to "move faster" | Knowledge silos, increasing bug rate, onboarding pain | 1-approval lightweight review with 4-hour SLA |
| Adding Redis, Elasticsearch, and Kafka simultaneously | Operational complexity explosion | Add one technology at a time, only when data proves need |
| Zero technical debt paydown | Velocity drops 30-50% within 6 months | Dedicate 15-20% of sprint capacity to debt |
| No documentation or onboarding guide | New engineers take 4+ weeks to become productive | README, architecture doc, runbooks, onboarding guide |
| Manual deployments or "deploy Fridays" | Fear of deploying, larger batches, more risk | CI/CD with automated rollback on error rate spike |
| Premature microservices extraction | Distributed monolith with network overhead | Extract only when team or deployment boundaries require it |

---

## Checklist

- [ ] Structured logging with correlation IDs on every request
- [ ] Error tracking (Sentry or equivalent) with Slack alerts
- [ ] Application metrics: latency p50/p95/p99, error rate, DB query times
- [ ] Slow query log enabled, top offenders fixed
- [ ] N+1 query detection enabled in development
- [ ] Redis caching for read-heavy endpoints with explicit TTLs
- [ ] Background job queue for email, webhooks, and async processing
- [ ] CDN serving all static assets
- [ ] Code review required on all PRs (1 approval)
- [ ] CI pipeline: lint, typecheck, test, coverage gate
- [ ] Onboarding documentation: README, architecture diagram, runbooks
- [ ] OWASP top 10 mitigations applied
- [ ] Dependency scanning enabled (Dependabot or Snyk)
- [ ] Secrets stored in environment variables, rotated periodically
- [ ] Monthly infrastructure cost review with billing alerts
- [ ] 15-20% of sprint capacity allocated to technical debt
