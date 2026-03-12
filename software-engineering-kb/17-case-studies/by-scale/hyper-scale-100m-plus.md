# Engineering at 100M+ Users (Hyper-Scale)

| Attribute    | Value                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| Domain       | Case Studies > By Scale                                                        |
| Importance   | High                                                                           |
| Last Updated | 2026-03-10                                                                     |
| Cross-ref    | [Scaling to 1M](scaling-1m-users.md), [Scalability Case Studies](../../10-scalability/case-studies/) |

---

## Core Concepts

### Stage-Appropriate Engineering Decisions

At 100M+ users, engineering is inseparable from organizational design. Technical decisions are constrained by Conway's Law, regulatory compliance, and global infrastructure requirements. The challenge is not "can we scale the system" but "can we scale the system while 200+ engineers ship features independently without breaking each other." Every architectural choice has organizational implications and vice versa.

### Typical Parameters

- **Users**: 10M-100M+ DAU, global distribution
- **Team**: 200-2,000+ engineers across dozens of teams
- **Revenue**: $100M+ ARR, public or late-stage private
- **Infrastructure cost**: $1M-50M+/month
- **Primary risk**: Organizational complexity, reliability at global scale, regulatory compliance

---

## Architecture

### Distributed Systems as the Default

```
Hyper-Scale Architecture Patterns:
  ┌────────────────────────────────────────────────────┐
  │                 Global Edge Layer                    │
  │  CDN + Edge Functions (Cloudflare/CloudFront)       │
  └───────────────────────┬────────────────────────────┘
                          │
  ┌───────────────────────┴────────────────────────────┐
  │              API Gateway / Service Mesh              │
  │        (Envoy / Istio / AWS API Gateway)            │
  └──┬──────────┬──────────┬──────────┬────────────────┘
     │          │          │          │
  ┌──┴──┐   ┌──┴──┐   ┌──┴──┐   ┌──┴──┐
  │User │   │Feed │   │Msg  │   │Pay  │   ... 20+ services
  │Svc  │   │Svc  │   │Svc  │   │Svc  │
  └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘
     │          │          │          │
  ┌──┴──────────┴──────────┴──────────┴──┐
  │        Event Bus (Kafka)              │
  └──┬──────────┬──────────┬─────────────┘
     │          │          │
  ┌──┴──┐   ┌──┴──┐   ┌──┴──────────┐
  │OLTP │   │Cache │   │Search      │
  │(CDB)│   │(Redis│   │(Elastic)   │
  └─────┘   │Cluster)  └────────────┘
             └──────┘
```

### Eventual Consistency as a First-Class Concern

```
Strong Consistency (use sparingly):
  → Financial transactions, account balances
  → Inventory decrements, seat reservations
  → Authentication state

Eventual Consistency (use by default):
  → Feed generation, timeline updates
  → Notification delivery
  → Analytics, counters, leaderboards
  → Search index updates
  → Recommendation recalculation

Design Pattern: Write to primary + publish event → consumers update derived views
```

Apply CQRS by separating write and read models: the write side validates commands and appends events to an event store, then publishes to an event bus. Read-side projections consume events and update optimized query models (search indexes, materialized views, caches). This decoupling allows independent scaling of reads and writes.

---

## Global Infrastructure

### Multi-Region Deployment

```
Region Strategy:
  Primary:   us-east-1 (North America)
  Secondary: eu-west-1 (Europe)
  Tertiary:  ap-southeast-1 (Asia-Pacific)

Traffic Routing:
  → GeoDNS routes users to nearest region
  → Failover routing if a region becomes unhealthy
  → Data replication: async for non-critical, sync for financial

Data Sovereignty:
  → EU user data stays in EU region (GDPR)
  → Tenant-level region assignment for B2B
  → Cross-region queries require explicit justification
```

### Edge Computing

The edge layer handles: static asset serving, JWT validation, rate limiting and DDoS protection, request routing (A/B, canary, geo), API response caching, and bot detection/WAF. Use edge compute (Cloudflare Workers, Lambda@Edge) for personalization, image optimization, and request transformation.

---

## Database at Hyper-Scale

### Polyglot Persistence

```
Choose the right database for each workload:
  ┌──────────────────┬────────────────────────────────────┐
  │ Workload         │ Database                            │
  ├──────────────────┼────────────────────────────────────┤
  │ Transactional    │ CockroachDB / Spanner / Vitess     │
  │ User profiles    │ PostgreSQL (sharded) / DynamoDB     │
  │ Sessions/cache   │ Redis Cluster / Memcached           │
  │ Search           │ Elasticsearch / OpenSearch           │
  │ Time-series      │ InfluxDB / TimescaleDB / ClickHouse│
  │ Graph relations  │ Neo4j / Neptune                     │
  │ Document storage │ MongoDB / DynamoDB                  │
  │ Analytics (OLAP) │ BigQuery / Snowflake / ClickHouse  │
  │ Event store      │ Kafka (log) + PostgreSQL / Scylla  │
  │ ML features      │ Redis / Feast / Tecton              │
  └──────────────────┴────────────────────────────────────┘
```

### NewSQL for Global Transactions

Use CockroachDB or Spanner when you need globally distributed, strongly consistent transactions. CockroachDB supports `LOCALITY REGIONAL BY ROW` for automatic data placement by region. Spanner uses TrueTime for global consistency. Both provide automatic sharding and multi-region replication. Reserve these for workloads that genuinely require cross-region strong consistency (financial transactions, inventory).

---

## Reliability

### 99.99%+ Uptime Engineering

```
99.99% = 4.3 minutes downtime per month
99.999% = 26 seconds downtime per month

Reliability Stack:
  ┌─────────────────────────────────────────────┐
  │ Chaos Engineering                            │
  │  Continuously inject failures in production  │
  │  (Gremlin, Litmus, custom game days)         │
  ├─────────────────────────────────────────────┤
  │ Cell-Based Architecture                      │
  │  Isolate blast radius to a subset of users   │
  │  Each cell: independent infra, DB, cache     │
  ├─────────────────────────────────────────────┤
  │ Graceful Degradation                         │
  │  Serve stale cache when backend is down      │
  │  Disable non-critical features under load    │
  │  Static fallback pages for total outage      │
  ├─────────────────────────────────────────────┤
  │ Progressive Rollouts                         │
  │  Canary → 1% → 5% → 25% → 100%             │
  │  Automated rollback on error rate spike      │
  └─────────────────────────────────────────────┘
```

### Cell-Based Architecture

```
Global Router
  ├── Cell US-1 (users A-M, US West)
  │   ├── Application servers
  │   ├── Database primary + replicas
  │   ├── Cache cluster
  │   └── Message queue
  ├── Cell US-2 (users N-Z, US East)
  │   └── (independent infrastructure)
  ├── Cell EU-1 (EU users)
  │   └── (independent infrastructure, EU data residency)
  └── Cell AP-1 (APAC users)
      └── (independent infrastructure)

Benefit: Failure in Cell US-1 affects only ~25% of users.
```

---

## Team at Scale (200+ Engineers)

### Organizational Structure

Organize around domains, not functions. Each domain (Consumer Product, Enterprise, Platform, Trust & Safety) contains 3-5 squads of 5-8 engineers. Add enabling teams (Architecture, Developer Advocacy) that support all domains without owning product delivery. The Platform domain (DevEx, Infrastructure, Data Platform, Observability) serves all stream-aligned teams.

### Conway's Law as a Design Tool

Use Conway's Law intentionally: design team boundaries to match desired system architecture. If you want independent services, create independent teams first.

```
Inverse Conway Maneuver:
  1. Define the desired architecture (which services, which boundaries)
  2. Organize teams to mirror that architecture (one team per service/domain)
  3. The communication structure produces the system structure naturally
  4. Review quarterly: if teams are constantly coordinating, boundaries are wrong
```

---

## Developer Tooling

### Custom Build Systems and Monorepo Tooling

```
Monorepo Tooling at Scale:
  Build System:     Bazel / Buck2 / Nx (with remote cache)
  Package Manager:  pnpm workspaces / Turborepo
  Code Generation:  Protobuf → client/server stubs, OpenAPI → SDKs
  Test Execution:   Distributed test runner (split by file, run in parallel)
  Code Health:      Automated dependency updates, dead code removal

Build Performance Targets:
  → Incremental build: < 30 seconds (affected targets only)
  → Full CI pipeline: < 20 minutes (parallelized across 50+ workers)
  → Remote cache hit rate: > 80% (avoid redundant builds)
```

### Automated Code Health

Track weekly: dependency freshness (> 90% within 1 major version), dead code ratio (< 5%), test coverage by criticality (> 85% critical paths), and API contract drift (100% spec compliance). Automate remediation: auto-PR for dependency updates, auto-PR for dead code removal, block deploys on contract drift.

---

## Data Infrastructure

### Real-Time Pipelines and ML Platform

```
Real-Time Data Architecture:
  ┌──────────┐     ┌──────────┐     ┌──────────────┐
  │ Services │────→│ Kafka    │────→│ Stream       │
  │ (events) │     │ (topics) │     │ Processing   │
  └──────────┘     └──────────┘     │ (Flink/Spark)│
                                     └──────┬───────┘
                        ┌──────────────────┼──────────────┐
                        │                  │              │
                   ┌────┴────┐       ┌────┴────┐   ┌────┴─────┐
                   │Real-Time│       │Data     │   │ML Feature│
                   │Dashboards│      │Warehouse│   │Store     │
                   └─────────┘       └─────────┘   └──────────┘

Experimentation Platform:
  → A/B testing infrastructure (Statsig, Eppo, or custom)
  → Feature flag system supporting gradual rollouts
  → Statistical significance calculation (automated, not manual)
  → Experiment velocity target: 50+ experiments running concurrently
```

---

## Cost Engineering

### FinOps Discipline

```
Cost Optimization Hierarchy:
  1. Architecture efficiency → cache, precompute, batch, eliminate redundancy
  2. Right-sizing → CPU/memory by p95 usage, spot instances for batch (60-80% savings)
  3. Reserved capacity → 1-year RIs for steady-state (30-40% savings)
  4. Workload scheduling → off-peak batch, scale down non-prod, tiered storage

Monthly Cost Review:
  → Per-team cost attribution (tag all resources by team)
  → Cost per user / cost per request metrics
  → Anomaly detection (alert on > 20% week-over-week increase)
```

---

## Culture and Knowledge Management

### Engineering Principles

Document and reinforce engineering principles that guide decisions when there is no explicit policy.

```
Example Engineering Principles:
  1. Prefer boring technology over novel technology
  2. Design for failure -- assume every dependency will fail
  3. Measure twice, cut once -- validate with data before large investments
  4. Ship small, ship often -- smaller changes are safer changes
  5. Own what you build -- the team that writes it operates it
  6. Simplicity is a feature -- every abstraction has a maintenance cost
  7. Write for the reader -- code is read 10x more than it is written
  8. Automate the toil -- if a human does it twice, automate it
```

### Knowledge Management at Scale

```
Knowledge Systems:
  ├── ADRs (Architecture Decision Records) → searchable, linked to code
  ├── Tech Radar → quarterly review, guides technology adoption
  ├── Engineering Blog (internal) → deep dives on system design decisions
  ├── Incident reports → blameless, with timelines and action items
  ├── Service catalog → ownership, SLOs, dependencies, runbooks
  └── On-call handoff docs → per-service operational knowledge
```

---

## Organizational Challenges

### Communication Overhead

```
Brooks's Law: Adding people to a late project makes it later.
Communication channels = n(n-1)/2

50 engineers  →  1,225 potential channels
200 engineers → 19,900 potential channels

Mitigation:
  → Strong team boundaries (minimize cross-team dependencies)
  → Async communication by default (written RFCs, not meetings)
  → Clear API contracts between teams (OpenAPI, protobuf)
  → Shared libraries and platform abstractions (reduce coordination)
  → Architecture reviews only for cross-domain changes
```

### Decision-Making at Scale

Scale decisions by impact: within one team (tech lead decides), two teams (lightweight RFC, both tech leads approve), cross-domain (full RFC + architecture review board), org-wide such as new language or major migration (RFC + executive sponsor, VP Eng + CTO approve).

---

## 10 Key Lessons

1. **Treat organizational design as a technical decision.** Team boundaries become service boundaries. Optimize for independent deployment and minimal cross-team coordination. Refactor teams as deliberately as you refactor code.

2. **Embrace eventual consistency as the default.** Strong consistency across regions is expensive and slow. Design user experiences that tolerate staleness (optimistic UI, background sync) and reserve strong consistency for financial transactions.

3. **Build cell-based architecture for blast radius containment.** A single deployment should not risk all users. Cells provide independent failure domains. Route users to cells and contain failures to a fraction of the user base.

4. **Invest in chaos engineering before outages teach the lesson.** Inject failures continuously in production: kill instances, introduce latency, simulate region failures. Systems that are tested under failure are resilient; systems that are assumed resilient are fragile.

5. **Adopt FinOps as a core engineering discipline.** At $1M+/month, a 10% efficiency gain pays for an engineer's salary. Tag all resources by team, measure cost-per-request, and include cost impact in architecture reviews.

6. **Automate developer experience relentlessly.** Custom build systems, remote caching, automated code health, and ephemeral environments are not luxuries -- they are force multipliers. A 200-person engineering org where builds take 5 minutes ships 3x faster than one where builds take 30 minutes.

7. **Operate a real-time data platform, not just a data warehouse.** Batch ETL is insufficient for personalization, fraud detection, and operational analytics. Invest in streaming (Kafka + Flink) and a feature store for ML models.

8. **Scale decision-making by pushing authority to teams.** Within-team decisions need no approval. Cross-team decisions need lightweight RFCs. Only org-wide technology changes require executive review. Centralized decision-making creates bottlenecks at 200+ engineers.

9. **Codify engineering principles, not just coding standards.** Principles like "design for failure" and "own what you build" guide thousands of small decisions that no process can cover. Document, reinforce in reviews, and hire for alignment.

10. **Plan for data sovereignty from the start of global expansion.** GDPR, data residency laws, and cross-border data transfer regulations constrain architecture. Design multi-region data storage with tenant-level region assignment before you need it.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Single global database for all regions | Latency for distant users, GDPR violations, single point of failure | Multi-region deployment with data sovereignty by design |
| Centralized architecture review board that approves every change | Decision bottleneck, 2-4 week approval delays | Push decisions to team level, reserve board for cross-domain changes |
| No cost attribution -- infrastructure is a shared budget | No accountability, costs grow 3-5x faster than users | Tag all resources by team, publish per-team cost dashboards |
| Monorepo without build optimization (Bazel/remote cache) | 60+ minute CI builds, developers avoid running tests | Invest in incremental builds, remote caching, test impact analysis |
| Strong consistency everywhere "to be safe" | 5-10x latency overhead, reduced availability during partitions | Default to eventual consistency, use strong only for financial/booking operations |
| No chaos engineering -- "production is too important to test" | First failure is discovered by users during peak traffic | Run chaos experiments continuously, start with staging, graduate to production |
| Shared database between services | Tight coupling, schema changes break multiple services, scaling impossible | Each service owns its data, communicate via APIs or events |
| Engineering principles exist only as a document no one reads | Inconsistent decisions, repeated debates | Reference principles in code reviews, RFCs, and hiring interviews |

---

## Checklist

- [ ] Multi-region deployment with geo-routing and data sovereignty compliance
- [ ] Cell-based or zone-based architecture with isolated blast radius
- [ ] Polyglot persistence: purpose-built databases for each workload type
- [ ] Event-driven architecture with Kafka (or equivalent) as the backbone
- [ ] CQRS implemented for high-read workloads with separate read models
- [ ] 99.99%+ availability targets with SLOs measured and enforced via error budgets
- [ ] Chaos engineering program running continuously in production
- [ ] Graceful degradation implemented: stale cache serving, feature toggling under load
- [ ] Team topologies aligned with system architecture (inverse Conway maneuver)
- [ ] Platform organization delivering build systems, observability, and developer tools
- [ ] CI/CD pipeline under 20 minutes with remote caching (80%+ hit rate)
- [ ] FinOps discipline: per-team cost attribution, cost-per-request tracking, anomaly alerts
- [ ] Real-time data pipeline (Kafka + Flink/Spark) operational
- [ ] Experimentation platform supporting 50+ concurrent A/B tests
- [ ] Engineering principles documented, reinforced in reviews and hiring
- [ ] Decision-making framework: team-level autonomy with RFC process for cross-cutting changes
- [ ] Service catalog with ownership, SLOs, dependencies, and runbooks for every service
- [ ] Incident management: automated detection, escalation, blameless postmortems, tracked follow-ups
