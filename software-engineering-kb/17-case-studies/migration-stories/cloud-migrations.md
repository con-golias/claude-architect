# Cloud Migration Strategies

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Migration Stories |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Cloud Providers](../../12-devops-infrastructure/cloud-providers/), [Infrastructure as Code](../../12-devops-infrastructure/infrastructure-as-code/) |

---

## Core Concepts

### The 7 R's of Cloud Migration

Use this framework to classify every workload before migration begins.

| Strategy | Description | When to Use | Effort |
|---|---|---|---|
| **Rehost** (lift and shift) | Move as-is to cloud VMs | Legacy apps, tight timelines, initial migration | Low |
| **Replatform** (lift, tinker, shift) | Minor optimizations (e.g., managed DB) | Apps that benefit from managed services without rewrites | Medium |
| **Repurchase** | Replace with SaaS (e.g., on-prem CRM → Salesforce) | Commodity software with better SaaS alternatives | Low-Medium |
| **Refactor** | Re-architect for cloud-native (serverless, containers) | Strategic apps that need elasticity, modern patterns | High |
| **Retire** | Decommission the workload | Redundant or unused applications (typically 10-20% of portfolio) | None |
| **Retain** | Keep on-premises (for now) | Compliance requirements, recent hardware investment, low ROI | None |
| **Relocate** | Move to cloud at infrastructure level (VMware on cloud) | VMware estates that need quick cloud presence | Low |

### Migration Phases

Follow a four-phase approach adapted from AWS, Azure, and GCP frameworks:

**Phase 1 — Assess (4-8 weeks):**
- Inventory all applications, dependencies, and data stores
- Classify each workload by the 7 R's framework
- Identify migration blockers (licensing, compliance, latency requirements)
- Build a total cost of ownership (TCO) model: current vs. projected cloud costs
- Establish migration success criteria and KPIs

**Phase 2 — Mobilize (4-12 weeks):**
- Build landing zone: VPC/VNet, IAM, networking, security guardrails
- Set up Infrastructure as Code (Terraform, CloudFormation, Bicep)
- Establish CI/CD pipelines for cloud deployments
- Train teams on cloud services, security model, and cost management
- Run a pilot migration with 1-2 low-risk workloads

**Phase 3 — Migrate (3-18 months):**
- Execute in waves: group workloads by dependency and risk
- Typical wave: 5-20 applications migrated together
- Run parallel environments during cutover windows
- Validate functionality, performance, and security at each wave
- Decommission on-premises resources after validation period

**Phase 4 — Optimize (ongoing):**
- Right-size instances based on actual utilization data (30-60 days post-migration)
- Implement auto-scaling policies
- Adopt reserved instances / savings plans for steady-state workloads
- Refactor high-value workloads toward cloud-native patterns
- Establish FinOps practice for continuous cost governance

### Lift and Shift — Reality Check

**When it works:**
- Deadline-driven migrations (data center lease expiration, EOL hardware)
- Applications with minimal cloud-specific optimization potential
- First phase of a multi-phase modernization strategy
- Regulatory requirements that mandate moving from specific on-prem locations

**When it fails:**
- Applications with tight latency requirements to on-prem databases
- License-bound software where cloud licensing costs 2-4x more (Oracle, SQL Server)
- Apps that waste 80% of provisioned resources — cloud bills reflect actual provisioning
- Expectation that lift-and-shift alone reduces costs — it often increases them by 10-30%

**Typical cost surprises:**
- Data egress fees (AWS: $0.09/GB after first 100GB) — budget for inter-region and internet traffic
- Managed service premium vs. self-managed (RDS vs. self-hosted PostgreSQL: 30-50% premium)
- Storage IOPS charges (EBS gp3 baseline is 3000 IOPS; exceeding requires provisioned IOPS pricing)
- Network Load Balancer per-flow charges at high connection counts

### Replatforming: The Sweet Spot

Replatforming delivers 60-80% of refactoring benefits at 30% of the effort:

- **Database:** Self-managed PostgreSQL → RDS/Cloud SQL (automated backups, patching, HA)
- **Containers:** VM-deployed apps → ECS/GKE/AKS (orchestration, scaling, self-healing)
- **Caching:** Self-managed Redis → ElastiCache/Memorystore (managed clustering, failover)
- **Queues:** Self-managed RabbitMQ → SQS/Pub/Sub (zero ops, auto-scaling)
- **Search:** Self-managed Elasticsearch → OpenSearch Service/Elastic Cloud

### Cloud-Native Refactoring

Reserve full refactoring for high-value, strategically important workloads:

- **Serverless:** Replace always-on services with Lambda/Cloud Functions for event-driven, spiky workloads
- **Managed databases:** Aurora Serverless, DynamoDB, Cosmos DB for elastic data tiers
- **Event-driven:** Replace polling with EventBridge/Cloud Events + queues
- **Edge computing:** Move latency-sensitive processing to CloudFront Functions, Cloudflare Workers

### Data Migration Strategies

**Database migration approaches:**

| Approach | Downtime | Complexity | Use Case |
|---|---|---|---|
| Dump and restore | Hours | Low | Small databases (< 100GB), can tolerate maintenance window |
| Continuous replication (DMS) | Minutes | Medium | Large databases, near-zero downtime requirement |
| Dual-write + switchover | Seconds | High | Mission-critical databases, zero-downtime requirement |
| CDC with Debezium | Seconds | High | Heterogeneous migration (e.g., Oracle → PostgreSQL) |

**Zero-downtime cutover sequence:**
1. Set up continuous replication from source to target (AWS DMS, Azure DMS, pglogical)
2. Validate data consistency with automated comparison tools
3. Lower DNS TTL to 60 seconds (at least 48 hours before cutover)
4. Stop writes to source, wait for replication lag to reach zero
5. Switch application connection strings to target
6. Update DNS records
7. Monitor for 24-48 hours before decommissioning source
8. Keep source available for 7-14 days as rollback safety net

### Real-World Examples

**Capital One — All-in on AWS (2015-2020):**
- Migrated 100% of workloads from 8 data centers to AWS
- Closed all 8 data centers, saving significant capital expenditure
- Built internal platform team to abstract AWS services for developers
- Key enabler: executive mandate and dedicated cloud engineering team
- Result: deployment frequency increased from monthly to multiple times daily

**Dropbox — Cloud → Own Infrastructure → Hybrid (2015-2017):**
- Left AWS S3 for custom-built storage system (Magic Pocket) for blob storage
- Saved $75M over 2 years on storage costs alone
- Kept metadata and orchestration services on AWS
- Lesson: at extreme scale (exabytes), owning storage hardware is cheaper than cloud
- Counter-lesson: this strategy only makes sense at Dropbox-scale (600PB+)

**Basecamp — Cloud → On-Prem (2022-2023):**
- Moved from AWS back to owned hardware
- Reported $7M projected savings over 5 years
- Workload profile: steady-state, predictable traffic, no burst scaling needs
- Lesson: cloud is not always cheaper for predictable, steady-state workloads

### Multi-Cloud Reality

**When multi-cloud makes sense:**
- Regulatory requirements mandate data residency in regions a single provider does not cover
- Acquiring a company already on a different cloud
- Specific best-of-breed services (e.g., GCP for ML, AWS for breadth)
- Negotiation leverage with cloud providers

**When multi-cloud is overhead:**
- "Avoiding vendor lock-in" as the primary justification — the portability tax exceeds lock-in costs
- Small/medium teams without dedicated platform engineering
- Applications that deeply leverage provider-specific managed services

**Portability cost:**
- Lowest-common-denominator services reduce cloud-native benefits
- Kubernetes helps with compute portability but not data or managed services
- Terraform providers differ significantly across clouds — true portability requires abstraction layers
- Operational complexity: 2x tooling, 2x training, 2x security configurations

### Cost Management

**FinOps from day 1 — not after the first shocking bill:**
- Tag every resource with team, environment, service, and cost center
- Set billing alerts at 50%, 80%, and 100% of monthly budget
- Review cost dashboards weekly during migration, monthly after stabilization
- Use AWS Cost Explorer / Azure Cost Management / GCP Billing Reports

**Cost optimization levers:**
- Reserved Instances / Savings Plans: 30-60% savings for 1-3 year commitments on steady-state
- Spot/Preemptible instances: 60-90% savings for fault-tolerant, stateless workloads
- Right-sizing: analyze 30 days of CloudWatch/Azure Monitor data, downsize overprovisioned instances
- Storage tiering: S3 Intelligent-Tiering, lifecycle policies to archive cold data
- Shut down non-production environments outside business hours (40-60% savings on dev/staging)

---

## 10 Key Lessons

1. **Assess before migrating — not every workload belongs in the cloud.** Retire 10-20% of applications and retain those with poor cloud ROI before spending on migration.

2. **Lift and shift is a starting point, not the destination.** Plan a modernization roadmap for replatforming or refactoring within 6-12 months post-migration.

3. **Budget for data egress from day 1.** Egress fees are the most common cost surprise — model inter-region, inter-service, and internet egress before committing.

4. **Build the landing zone before migrating the first workload.** VPC layout, IAM structure, networking, and security guardrails must be in place — retrofitting is 5x more expensive.

5. **Replatform for the best effort-to-value ratio.** Swapping self-managed databases and queues for managed services delivers immediate operational savings with minimal code changes.

6. **Migrate in waves, not all at once.** Group applications by dependency, start with low-risk workloads, and build team confidence before tackling critical systems.

7. **Lower DNS TTL weeks before cutover.** Cached DNS records with high TTL cause split-brain scenarios — set TTL to 60 seconds at least 48 hours before migration.

8. **Multi-cloud is a strategy, not a default.** Unless driven by regulation or acquisition, single-cloud with deep integration outperforms multi-cloud with lowest-common-denominator services.

9. **Establish FinOps practice during migration, not after.** Assign cost ownership to teams, enforce tagging, and review costs weekly — migration is when spending habits form.

10. **Keep rollback capability for 14 days post-cutover.** Maintain the source environment and replication until confidence is established — decommission only after validation.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Lift and shift everything | Cloud bill exceeds on-prem costs by 30%+ | Classify workloads by 7 R's; retire and retain where appropriate |
| No landing zone | Security gaps, inconsistent networking, IAM sprawl | Build landing zone with IaC before first migration wave |
| Ignoring egress costs | Unexpected $50K+ monthly charges from inter-region traffic | Model data flows and egress costs during assessment phase |
| Big-bang cutover | Extended outages, no rollback path | Phased migration with dual-run and feature flags |
| Multi-cloud by default | 2x operational complexity, lowest-common-denominator services | Single-cloud unless regulation or acquisition demands otherwise |
| No cost tagging | Cannot attribute costs to teams or services; waste goes undetected | Enforce tagging policy via IaC and deny untagged resource creation |
| Premature commitment | Buying 3-year reserved instances before understanding actual usage | Wait 30-60 days post-migration; right-size first, then commit |
| Skipping training | Teams use cloud like on-prem, missing managed service benefits | Invest in cloud certification and hands-on labs before migration |

---

## Checklist

- [ ] Complete application inventory with dependency mapping
- [ ] Classify every workload using the 7 R's framework
- [ ] Build TCO model comparing on-prem vs. cloud (include egress, licensing, ops)
- [ ] Deploy landing zone with VPC, IAM, networking, and security guardrails via IaC
- [ ] Set up CI/CD pipelines targeting cloud environments
- [ ] Configure billing alerts and cost tagging policy before first migration
- [ ] Execute pilot migration with 1-2 low-risk workloads
- [ ] Validate data migration with automated consistency checks
- [ ] Lower DNS TTL to 60 seconds at least 48 hours before cutover
- [ ] Maintain rollback capability for 14 days post-cutover
- [ ] Right-size instances after 30 days of production utilization data
- [ ] Establish weekly FinOps review cadence
