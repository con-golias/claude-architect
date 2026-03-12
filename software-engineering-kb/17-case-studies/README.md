# 17 — Case Studies

> Learn from the best — real-world engineering decisions, company architectures, migration strategies, and post-incident lessons from industry leaders.

## Structure (4 folders, 19 files)

### by-company/ (8 files)
- [spotify.md](by-company/spotify.md) — Squad model (and its evolution), Backstage, Scio/Beam data infra, trunk-based dev, BFF pattern, GCP migration
- [stripe.md](by-company/stripe.md) — API-first design, date-based versioning, Ruby→Java migration, Sorbet type checker, financial-grade canary deploys
- [netflix.md](by-company/netflix.md) — 700+ microservices, Chaos Monkey/Simian Army, Zuul/Eureka/Hystrix/Spinnaker, Freedom & Responsibility culture
- [google.md](by-company/google.md) — Monorepo (Piper), Bazel builds, readability reviews, SRE (error budgets/SLOs), Borg→K8s, Spanner, design docs
- [meta.md](by-company/meta.md) — PHP→Hack, React/GraphQL/Relay/Jest ecosystem, TAO graph DB, Memcache at scale, React Native, Buck2/Sapling
- [uber.md](by-company/uber.md) — DOMA architecture, H3 geospatial, Kafka/Hudi data platform, RIBs mobile framework, Jaeger tracing
- [airbnb.md](by-company/airbnb.md) — Rails→SOA migration, server-driven UI, DLS design system, Airflow/Superset (open-sourced), Minerva metrics
- [shopify.md](by-company/shopify.md) — Modular monolith (Rails at scale), Packwerk boundaries, YJIT compiler, flash sale architecture, Spin dev environments

### by-scale/ (4 files)
- [startup-mvp.md](by-scale/startup-mvp.md) — Tech stack selection, monolith-first, PaaS deployment, intentional debt, ship speed, what NOT to do
- [growing-10k-users.md](by-scale/growing-10k-users.md) — First scaling issues, caching/CDN, observability, team growth (5-15 eng), process introduction, security basics
- [scaling-1m-users.md](by-scale/scaling-1m-users.md) — Modular monolith decision, K8s/IaC, SLOs, platform team, RFC process, SOC2, data platform
- [hyper-scale-100m-plus.md](by-scale/hyper-scale-100m-plus.md) — Distributed systems, multi-region, cell architecture, 200+ engineers, FinOps, chaos engineering

### migration-stories/ (4 files)
- [monolith-to-microservices.md](migration-stories/monolith-to-microservices.md) — Strangler Fig, Branch by Abstraction, service extraction playbook, Amazon/Netflix/Shopify examples
- [cloud-migrations.md](migration-stories/cloud-migrations.md) — 7 R's framework, lift-and-shift reality, replatforming, Capital One/Dropbox examples, FinOps
- [database-migrations.md](migration-stories/database-migrations.md) — Zero-downtime pattern (dual-write/shadow/cutover), GitHub Vitess, Discord Cassandra→ScyllaDB, expand-contract
- [language-migrations.md](migration-stories/language-migrations.md) — JS→TS, Python→Go, Ruby→Rust, PHP→Hack, Netscape syndrome, migration strategies

### postmortems/ (3 files)
- [famous-outages.md](postmortems/famous-outages.md) — AWS S3 (2017), Cloudflare regex (2019), Meta BGP (2021), GitHub split-brain (2018), CrowdStrike (2024), GitLab DB deletion (2017)
- [security-breaches-lessons.md](postmortems/security-breaches-lessons.md) — Equifax, SolarWinds, Log4Shell, Uber social engineering, MOVEit SQLi, LastPass — engineering root causes
- [performance-incidents.md](postmortems/performance-incidents.md) — Twitter Fail Whale, Reddit hug of death, Slack memory leaks, LinkedIn ML latency, Pinterest DB scaling, Spotify CDN

## Cross-References

| Topic | This Section | Related Section |
|-------|-------------|----------------|
| Scaling patterns (technical) | by-scale/ (holistic decisions) | [10-scalability/case-studies/](../10-scalability/case-studies/) (scaling patterns) |
| Postmortem process | postmortems/ (real incidents) | [12-devops/incident-management/postmortems.md](../12-devops-infrastructure/incident-management/postmortems.md) (process) |
| Security breaches | postmortems/security-breaches-lessons.md | [08-security/](../08-security/) (prevention) |
| Performance tuning | postmortems/performance-incidents.md | [09-performance/](../09-performance/) (techniques) |
| Database migrations | migration-stories/database-migrations.md | [07-database/](../07-database/) (fundamentals) |
| Microservices architecture | migration-stories/monolith-to-microservices.md | [03-architecture/](../03-architecture/) (patterns) |
| Team topologies | by-company/*.md | [15-product-engineering/team-organization/](../15-product-engineering/team-organization/) (theory) |

## Perspective Differentiation

| Section | Focus |
|---------|-------|
| 03-architecture | Architectural patterns and theory |
| 10-scalability | Technical scaling patterns and infrastructure |
| 12-devops | Operational practices and tooling |
| **17-case-studies** | **Real-world engineering stories — what companies actually did, why, and what we can learn** |
