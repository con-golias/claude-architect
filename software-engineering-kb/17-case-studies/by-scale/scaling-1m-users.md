# Engineering at 1M Users (Scale-Up)

| Attribute    | Value                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| Domain       | Case Studies > By Scale                                                        |
| Importance   | High                                                                           |
| Last Updated | 2026-03-10                                                                     |
| Cross-ref    | [10K Users](growing-10k-users.md), [100M+ Users](hyper-scale-100m-plus.md), [Scalability Case Studies](../../10-scalability/case-studies/) |

---

## Core Concepts

### Stage-Appropriate Engineering Decisions

At 1M users the organization transitions from startup to scale-up. Engineering challenges shift from "can we build it" to "can we build it reliably, repeatedly, and across multiple teams." Architecture decisions carry long-term consequences. The monolith may need decomposition -- but only where team boundaries or deployment frequency demand it. Reliability, developer experience, and organizational design become first-class engineering concerns.

### Typical Parameters

- **Users**: 100K-1M active users (DAU), established growth trajectory
- **Team**: 30-80 engineers across multiple squads
- **Revenue**: Series B/C, $5M-50M ARR
- **Infrastructure cost**: $20K-200K/month
- **Primary risk**: Organizational and reliability risk

---

## Architecture Decisions

### Monolith to Modular Monolith or Selective Extraction

```
Decision Framework: When to Extract a Service
─────────────────────────────────────────────
Extract when ALL of these are true:
  ✓ A team owns this domain exclusively (clear ownership boundary)
  ✓ This domain deploys 5x+ more frequently than the rest
  ✓ This domain has fundamentally different scaling characteristics
  ✓ The interface between this domain and others is well-defined

Do NOT extract when:
  ✗ "It would be cleaner" (architectural aesthetics)
  ✗ Two modules share a database table heavily
  ✗ The team is < 5 people (overhead exceeds benefit)
  ✗ You cannot define the API contract in 30 minutes
```

### Typical 1M-User Architecture

```
                    ┌─────────────┐
                    │   CDN       │
                    │ (CloudFront)│
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │ Load Balancer│
                    │   (ALB)     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────┴──┐  ┌─────┴────┐  ┌───┴───────┐
       │ API     │  │ Monolith │  │ Extracted  │
       │ Gateway │  │ (Core)   │  │ Service(s) │
       └────┬────┘  └────┬─────┘  └─────┬─────┘
            │             │              │
       ┌────┴──────┬──────┴──────┬───────┘
       │           │             │
  ┌────┴───┐ ┌────┴───┐  ┌─────┴────┐
  │Primary │ │Read    │  │ Redis    │
  │   DB   │ │Replicas│  │ Cluster  │
  └────────┘ └────────┘  └──────────┘
                               │
                        ┌──────┴──────┐
                        │ Message     │
                        │ Queue       │
                        │ (SQS/Redis) │
                        └─────────────┘
```

### Service Extraction Pattern

```typescript
// Phase 1: Modular monolith -- define internal API contracts
// modules/notifications/notification.service.ts
export interface NotificationService {
  send(userId: string, notification: Notification): Promise<void>;
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void>;
}

// Phase 2: Replace implementation with HTTP/gRPC client
// The interface stays the same -- callers do not change
export class RemoteNotificationService implements NotificationService {
  constructor(private readonly baseUrl: string) {}

  async send(userId: string, notification: Notification): Promise<void> {
    await fetch(`${this.baseUrl}/api/notifications`, {
      method: "POST",
      body: JSON.stringify({ userId, notification }),
    });
  }
}
```

---

## Database Scaling

### Multi-Layer Strategy

```
Layer 1: Query Optimization (always first)
  → Analyze slow query log weekly
  → Maintain index health (reindex, remove unused)
  → Optimize top 10 queries by total execution time

Layer 2: Read Replicas
  → Route analytics, dashboards, search to replicas
  → Lag monitoring (alert if replica lag > 5s)
  → Connection routing at application level or proxy (PgBouncer)

Layer 3: Caching
  → Application-level cache (Redis) for hot data
  → Query result cache for expensive aggregations
  → Cache-aside pattern with explicit invalidation

Layer 4: Partitioning (if needed)
  → Partition by time for event/log tables
  → Partition by tenant for multi-tenant SaaS
  → Keep partitioned tables under 100M rows per partition
```

```sql
-- Time-based partitioning for high-volume event tables
CREATE TABLE events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  tenant_id   UUID NOT NULL,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_q1 PARTITION OF events
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE events_2026_q2 PARTITION OF events
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
```

### Connection Pooling at Scale

```
Application (30-80 instances)
  → Each instance: 5-10 connections
  → Total: 150-800 connections

PostgreSQL max_connections: 200 (default, rarely increase)

Solution: PgBouncer in transaction mode
  → 800 application connections → 50-100 PgBouncer connections → PostgreSQL
  → Reduces connection overhead by 10x
```

---

## Infrastructure

### Kubernetes Adoption

At this scale, Kubernetes becomes justified. The team is large enough to absorb the operational complexity, and deployment frequency demands container orchestration. Essential configuration: rolling updates (maxUnavailable: 1), resource requests/limits on every pod, readiness and liveness probes, and horizontal pod autoscaling.

### Infrastructure as Code

```
IaC Stack at 1M Users:
  Terraform        → Cloud resources (VPCs, databases, Kubernetes clusters)
  Helm / Kustomize → Kubernetes application manifests
  GitHub Actions   → CI/CD pipelines
  Atlantis / Spacelift → Terraform PR automation

Enforce:
  → All infrastructure changes via PR (no manual console changes)
  → Terraform state stored remotely (S3 + DynamoDB lock)
  → Plan output reviewed before apply
  → Separate environments: staging, production (minimum)
```

---

## Reliability

### SLOs, SLIs, and Incident Management

```
Define SLOs for Core User Journeys:
  ┌──────────────────┬──────────────┬──────────────┐
  │ Journey          │ SLI          │ SLO          │
  ├──────────────────┼──────────────┼──────────────┤
  │ API availability │ Success rate │ 99.9%        │
  │ Page load        │ p95 latency  │ < 1.5s       │
  │ Checkout flow    │ Success rate │ 99.95%       │
  │ Search           │ p99 latency  │ < 500ms      │
  └──────────────────┴──────────────┴──────────────┘

Error Budget = 1 - SLO
  99.9% SLO → 43 minutes downtime / month error budget
  99.95% SLO → 21 minutes downtime / month error budget
```

### On-Call and Postmortems

- Establish on-call rotation across teams (1-week rotations, minimum 5 engineers per rotation).
- Define escalation paths: L1 (on-call) -> L2 (team lead) -> L3 (VP Eng).
- Blameless postmortems for every SEV-1 and SEV-2 incident.
- Track action items from postmortems to completion.

---

## Team Organization

### Team Topologies at 30-80 Engineers

```
Stream-Aligned Teams (product delivery):
  ├── Team Onboarding (signup, activation, first experience)
  ├── Team Core (main product features)
  ├── Team Billing (payments, subscriptions, invoicing)
  ├── Team Growth (engagement, retention, notifications)
  └── Team Enterprise (SSO, RBAC, audit logs)

Platform Team (internal developer experience):
  └── Team Platform (CI/CD, Kubernetes, observability, developer tools)

Enabling Team (cross-cutting support):
  └── Team Security (AppSec, compliance, security tooling)
```

### Platform Team Investment

Invest in an internal developer platform when the cost of every team solving the same infrastructure problems exceeds the cost of a dedicated platform team (typically at 30+ engineers).

```
Platform Team Deliverables (in priority order):
  1. CI/CD pipeline (< 15 min build-to-deploy)
  2. Observability stack (metrics, logs, traces -- unified)
  3. Service template / scaffolding (new service in < 1 hour)
  4. Development environments (ephemeral, production-like)
  5. Deployment tooling (canary releases, feature flags, rollback)
```

---

## Developer Experience

### CI/CD Pipeline Optimization

```
Target: Push to production in < 15 minutes
  ┌────────┐  ┌──────┐  ┌──────┐  ┌───────┐  ┌────────┐
  │ Lint + │→ │ Unit │→ │Integ │→ │ Build │→ │ Deploy │
  │Typecheck│  │Tests │  │Tests │  │Image  │  │Canary  │
  │ (2 min) │  │(3 min)│  │(5 min)│  │(2 min)│  │(3 min) │
  └────────┘  └──────┘  └──────┘  └───────┘  └────────┘

Techniques to hit 15-minute target:
  → Parallelize test suites across CI workers
  → Cache dependencies (node_modules, Docker layers)
  → Run only affected tests on PR (test impact analysis)
  → Use ephemeral runners close to artifact storage
```

### Development Environments

- Provide production-like dev environments via Docker Compose or Tilt.
- Offer ephemeral preview environments per PR (Vercel previews, Argo CD PR apps).
- Seed databases with realistic data (anonymized production snapshots).

---

## Data Platform

### Analytics Pipeline Maturation

```
OLTP (PostgreSQL)
  │
  ├──→ CDC / ETL ──→ Data Warehouse (BigQuery / Snowflake / Redshift)
  │                        │
  │                   ┌────┴─────┐
  │                   │ dbt      │ (transform, model, test)
  │                   └────┬─────┘
  │                        │
  │                   ┌────┴──────────┐
  │                   │ BI Dashboard  │ (Metabase / Looker / Preset)
  │                   └───────────────┘
  │
  └──→ Product Analytics (PostHog / Amplitude / Mixpanel)
```

---

## Security Maturation

### SOC2 and Security Program

```
Security Milestones at This Stage:
  ✓ SOC2 Type I certification (then Type II within 12 months)
  ✓ Dedicated security engineer or contracted security team
  ✓ Annual penetration testing by external firm
  ✓ SAST in CI pipeline (Semgrep, CodeQL)
  ✓ DAST for staging environment (OWASP ZAP)
  ✓ Secrets scanning in CI (GitLeaks, TruffleHog)
  ✓ SSO support for enterprise customers (SAML / OIDC)
  ✓ Audit logging for all admin and sensitive actions
  ✓ Incident response plan documented and tested
```

---

## Decision-Making

### RFC Process

Introduce RFCs (Request for Comments) for decisions that affect multiple teams or are expensive to reverse. Each RFC includes: Problem statement, Proposed solution, Alternatives considered with trade-offs, Decision criteria (measurable), and a phased Timeline. Store RFCs in a searchable repository (GitHub repo, Notion, or Confluence) so they serve as an architectural decision archive.

### Tech Radar

Maintain a lightweight tech radar (Adopt / Trial / Assess / Hold) to guide technology choices across teams and prevent fragmentation.

---

## 10 Key Lessons

1. **Decompose by team boundary, not technical boundary.** Extract services where team ownership is clear and deployment independence is needed. Avoid extracting "the database layer" or "the notification system" without a team to own it.

2. **Invest in the platform team early.** When 6+ teams spend 20% of their time on infrastructure, a platform team pays for itself. Prioritize CI/CD, observability, and service templates.

3. **Define SLOs before the first major outage.** Reliability targets guide architecture decisions and on-call investment. Without SLOs, every incident triggers panic instead of measured response.

4. **Make the CI/CD pipeline fast or developers will bypass it.** A 15-minute pipeline gets respected. A 45-minute pipeline gets skipped with "I'll fix it in the next PR." Fast feedback loops compound into quality.

5. **Adopt Infrastructure as Code with no exceptions.** Every manual console change is a future incident. Terraform for cloud resources, Helm for Kubernetes, and PR-based workflow for all changes.

6. **Start the data platform before leadership demands dashboards.** Build the ETL pipeline, data warehouse, and basic dashboards proactively. Scrambling to answer "how many users did X last month" is a sign of under-investment.

7. **Establish the RFC process for cross-cutting decisions.** Written proposals with alternatives, trade-offs, and timelines produce better decisions than meetings. They also create a searchable archive of architectural reasoning.

8. **Pursue SOC2 certification proactively.** Enterprise customers require it. The certification process forces security hygiene (access controls, audit logs, incident response) that benefits everyone.

9. **Connection pooling is not optional at this scale.** Direct database connections from 50+ application instances exhaust PostgreSQL. PgBouncer or equivalent proxy reduces connection count by 10x.

10. **Measure developer experience quantitatively.** Track build times, deploy frequency, PR merge time, and time-to-first-commit for new hires. Treat developer productivity as a product with its own metrics.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Big-bang microservices migration | 6+ month project, distributed monolith outcome | Extract one service at a time with clear ownership |
| No platform team -- every squad builds its own CI/CD | Duplicated effort, inconsistent practices | Invest in platform team at 30+ engineers |
| SLOs defined but never measured or enforced | Reliability theater, no error budget discipline | Automate SLI measurement, review error budgets weekly |
| Manual infrastructure changes alongside Terraform | State drift, unexpected outages, audit failures | Enforce IaC-only changes via IAM policies |
| 45+ minute CI pipelines | Developers push large batches, skip tests locally | Parallelize, cache, run affected tests only |
| No on-call rotation -- founders handle all incidents | Burnout, slow response times, no institutional knowledge | Formal rotation with escalation paths and runbooks |
| Tech stack fragmentation (3 languages, 5 frameworks) | Hiring complexity, context-switching cost, inconsistent patterns | Tech radar with Adopt/Hold categories enforced in review |
| Extracting services without API contracts first | Tight coupling through shared databases or ad-hoc calls | Define interface contracts (OpenAPI/protobuf) before extraction |

---

## Checklist

- [ ] Architecture documented: which components are monolith, which are extracted, and why
- [ ] Service extraction criteria defined and agreed upon by engineering leadership
- [ ] Database scaling strategy: read replicas, connection pooling (PgBouncer), partitioning plan
- [ ] Kubernetes cluster operational with IaC (Terraform), multi-AZ deployment
- [ ] CI/CD pipeline under 15 minutes, push-to-production automated
- [ ] SLOs defined for top 5 user journeys, measured with automated SLI dashboards
- [ ] On-call rotation established with runbooks, escalation paths, and postmortem process
- [ ] Platform team staffed and delivering CI/CD, observability, and service templates
- [ ] Team topologies defined: stream-aligned, platform, and enabling teams
- [ ] RFC process active for cross-team architectural decisions
- [ ] Data platform operational: warehouse, ETL/dbt, BI dashboards
- [ ] SOC2 Type I achieved or in progress, annual pen test scheduled
- [ ] SAST, DAST, and secrets scanning integrated into CI pipeline
- [ ] Developer experience metrics tracked: build time, deploy frequency, onboarding time
- [ ] Tech radar published and reviewed quarterly
