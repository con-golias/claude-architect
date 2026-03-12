# Non-Functional Requirements (NFRs)

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Requirements |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [SLI/SLO/SLA](../../09-performance/performance-culture/sli-slo-sla.md), [Security by Design](../../08-security/foundations/security-by-design.md) |

---

## Core Concepts

### What Are Non-Functional Requirements

Non-functional requirements (NFRs) define how the system must behave rather than what it
must do. They specify quality attributes, constraints, and operational characteristics
that shape architecture decisions.

**Functional vs. Non-Functional:**
- Functional: "Users can search products by keyword" (what)
- Non-Functional: "Search results return within 200ms at p99 under 1,000 concurrent users" (how well)

NFRs are architecture drivers. Changing an NFR late in development often requires
rearchitecting, which is orders of magnitude more expensive than changing a functional
requirement.

### NFR Categories

#### ISO 25010 Quality Model

Use the ISO 25010 model as the canonical framework for categorizing NFRs.

| Category | Subcategories | Example NFR |
|----------|---------------|-------------|
| **Performance** | Time behavior, throughput, resource utilization | API p99 latency < 200ms |
| **Scalability** | Horizontal/vertical growth capacity | Support 10x current load with linear cost increase |
| **Reliability** | Availability, fault tolerance, recoverability | 99.9% uptime (8.76h downtime/year) |
| **Security** | Confidentiality, integrity, authentication | All PII encrypted at rest (AES-256) |
| **Usability** | Learnability, accessibility, user error protection | WCAG 2.2 AA compliance |
| **Maintainability** | Modularity, testability, analyzability | New developers productive within 2 weeks |
| **Portability** | Adaptability, installability, replaceability | Run on AWS, Azure, or GCP without code changes |
| **Compatibility** | Interoperability, co-existence | Support Chrome, Firefox, Safari (last 2 versions) |

---

## Quantifying NFRs

Every NFR must have a measurable target. Vague NFRs like "the system should be fast"
are unverifiable and therefore useless.

### Performance NFRs

```markdown
## Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| API response time (p50) | < 100ms | APM tool (Datadog/New Relic) |
| API response time (p99) | < 500ms | APM tool, measured over 24h |
| Page load time (LCP) | < 2.5s | Lighthouse CI, real user monitoring |
| First Input Delay (FID) | < 100ms | Chrome UX Report |
| Throughput | > 5,000 req/s per instance | Load test (k6) |
| Database query time (p99) | < 50ms | Slow query log analysis |
```

### Scalability NFRs

```markdown
## Scalability Requirements

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Concurrent users | Support 50,000 simultaneous | Load test (k6/Gatling) |
| Data volume | Handle 10TB without degradation | Benchmark with synthetic data |
| Horizontal scaling | Add capacity in < 5 minutes | Auto-scaling group test |
| Cost linearity | 2x load = < 2.2x cost | Cloud billing analysis |
```

### Reliability NFRs

```markdown
## Reliability Requirements

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Availability | 99.9% (8.76h downtime/year) | Uptime monitoring (Pingdom) |
| Recovery Time Objective (RTO) | < 15 minutes | Disaster recovery drill |
| Recovery Point Objective (RPO) | < 5 minutes of data loss | Backup restoration test |
| Mean Time Between Failures (MTBF) | > 720 hours | Incident tracking |
| Error rate | < 0.1% of requests return 5xx | APM dashboards |
```

### Security NFRs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Authentication | MFA for admin roles | Security audit |
| Encryption at rest | AES-256 for all PII | Infrastructure audit |
| Encryption in transit | TLS 1.3 minimum | SSL Labs scan |
| Vulnerability SLA | Critical CVE patched within 24h | Dependency scanning |
| OWASP Top 10 | Zero known vulnerabilities | DAST scan (ZAP) |

### Usability NFRs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Accessibility | WCAG 2.2 Level AA | axe-core + manual audit |
| Task completion | > 90% for core workflows | Usability testing |
| Onboarding | Setup in < 3 minutes | Analytics funnel |
| Browser support | Chrome, Firefox, Safari, Edge (last 2) | Cross-browser testing |

---

## NFR Templates

### Structured NFR Template

```typescript
interface NonFunctionalRequirement {
  id: string;                    // NFR-PERF-001
  category: NFRCategory;
  title: string;
  description: string;
  metric: string;                // what to measure
  target: string;                // specific threshold
  priority: "critical" | "important" | "desirable";
  measurementMethod: string;     // how to verify
  monitoringFrequency: string;   // how often to check
  owner: string;                 // who is accountable
  tradeoffs: string[];           // what this NFR trades off against
  relatedStories: string[];      // user stories this NFR constrains
}

type NFRCategory =
  | "performance" | "scalability" | "reliability" | "security"
  | "usability" | "maintainability" | "portability" | "compatibility";
```

### Planguage (Tom Gilb's Quantification Language)

Use Planguage for precise NFR specification when rigor is needed.

```markdown
## NFR: Search Response Time

- **Tag:** NFR-PERF-003
- **Type:** Performance
- **Scale:** Milliseconds for API response time at p99
- **Meter:** APM tool measured over a rolling 24-hour window
- **Must:** < 1,000ms (minimum acceptable)
- **Plan:** < 200ms (target for current release)
- **Wish:** < 50ms (ideal, future optimization)
- **Past:** 800ms (current baseline measurement)
- **Qualifier:** Under 2,000 concurrent users, production environment
- **Owner:** Search Team Lead
```

---

## NFRs as Architecture Drivers

NFRs directly shape technical decisions. Document the link between each NFR and the
architecture choice it drives.

```markdown
| NFR | Architecture Decision | Rationale |
|-----|----------------------|-----------|
| p99 latency < 200ms | Redis caching layer | Database alone cannot meet latency target |
| 99.9% availability | Multi-AZ deployment | Single AZ gives ~99.5% at best |
| 10x load growth | Stateless microservices | Monolith cannot scale horizontally |
| RPO < 5 minutes | Synchronous DB replication | Async replication risks data loss |
| WCAG 2.2 AA | Server-side rendering | Client-only rendering breaks screen readers |
| Deploy 10x/day | Feature flags + blue-green | Traditional releases too slow |
```

---

## Trade-offs Between NFRs

NFRs often conflict. Document trade-off decisions explicitly.

### Common Trade-off Pairs

| NFR A | NFR B | Tension | Resolution Strategy |
|-------|-------|---------|-------------------|
| Performance | Security | Encryption adds latency | Hardware acceleration, TLS session reuse |
| Usability | Security | MFA adds friction | Risk-based auth (MFA only for sensitive ops) |
| Scalability | Consistency | Distributed systems face CAP theorem | Eventual consistency where acceptable, strong for payments |
| Maintainability | Performance | Abstraction layers add overhead | Profile first, optimize hot paths only |
| Portability | Performance | Cloud-agnostic limits vendor-specific optimizations | Abstract at infrastructure layer, not application |
| Reliability | Cost | Redundancy is expensive | Tiered reliability (critical path = 99.99%, backoffice = 99.9%) |

For each trade-off, document: which NFR is prioritized, which is deprioritized, the
context, the decision, mitigations applied, and a review date to revisit.

---

## Testing NFRs

Each NFR category requires specific verification approaches.

| Category | Testing Approach | Tools |
|----------|-----------------|-------|
| **Performance** | Load testing, stress testing, benchmarking | k6, Gatling, Lighthouse CI |
| **Scalability** | Scale testing, chaos engineering, soak testing | k6, Chaos Monkey, Litmus |
| **Reliability** | Failover drills, chaos testing, recovery testing | Gremlin, Chaos Toolkit, custom DR scripts |
| **Security** | SAST, DAST, penetration testing, dependency scanning | Semgrep, ZAP, Snyk, Trivy |
| **Usability** | User testing, accessibility audits, heuristic evaluation | axe-core, Lighthouse, UserTesting.com |
| **Maintainability** | Code complexity analysis, coupling metrics, onboarding time | SonarQube, CodeClimate, deptry |
| **Portability** | Multi-environment deployment testing | Terraform plan, Docker multi-platform builds |
| **Compatibility** | Cross-browser testing, API versioning tests | Playwright (multi-browser), Pact |

### Automated NFR Verification in CI

Integrate NFR checks into CI pipelines to catch regressions on every commit:

- **Performance:** k6 load test with threshold assertions (fail if p99 > target)
- **Security:** SAST (Semgrep), dependency scan (audit-ci/Snyk), DAST (ZAP) on staging
- **Accessibility:** Lighthouse CI with score thresholds, axe-core in Playwright tests
- **Reliability:** Synthetic health checks, error rate monitoring post-deploy

---

## NFR Governance

### NFR Review Cadence

| Activity | Frequency | Participants |
|----------|-----------|-------------|
| NFR definition and review | At inception, quarterly refresh | Architect, PM, Tech Lead |
| NFR compliance check | Every sprint (automated in CI) | CI pipeline, on-call engineer |
| NFR trade-off review | When new NFRs conflict | Architect, PM, affected teams |
| NFR baseline update | After major releases | Platform team |

---

## 10 Best Practices

1. **Capture NFRs from day one.** NFRs shape architecture, and architecture is expensive to
   change. Capture them during initial discovery alongside functional requirements.

2. **Quantify every NFR with a measurable target.** Replace "fast" with "p99 < 200ms."
   Replace "secure" with "zero critical CVEs, TLS 1.3, MFA for admins."

3. **Use the Must/Plan/Wish scale.** Define minimum acceptable (Must), target (Plan), and
   ideal (Wish) thresholds. This gives the team flexibility to prioritize.

4. **Link NFRs to architecture decisions.** Document which NFR drove which technical choice.
   This prevents future developers from undermining the architecture unknowingly.

5. **Automate NFR verification in CI.** Run performance, security, and accessibility checks
   on every commit. Catching NFR regressions in CI is 100x cheaper than in production.

6. **Document trade-offs explicitly.** When two NFRs conflict, record the decision, the
   reasoning, the mitigations, and the review date.

7. **Assign ownership to each NFR.** Every NFR needs a team or individual accountable for
   monitoring and maintaining compliance.

8. **Review NFR baselines quarterly.** Systems evolve, traffic patterns change, and NFR
   targets may need adjustment. Re-baseline metrics after major changes.

9. **Tier NFRs by criticality.** Not every service needs 99.99% availability. Apply strict
   NFRs to critical paths and relaxed NFRs to back-office systems.

10. **Make NFRs visible on dashboards.** Display NFR compliance alongside functional metrics.
    If the team cannot see NFR status, NFRs will degrade silently.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Unmeasurable NFRs** ("system is performant") | Cannot verify, disputes at launch | Rewrite with specific metric and threshold |
| **NFRs captured too late** | Architecture cannot support them | Include NFR elicitation in initial discovery |
| **NFRs without owners** | No one monitors or maintains them | Assign team ownership to each NFR |
| **Copy-paste NFRs** (same targets for all services) | Over-engineering low-risk services, under-engineering critical ones | Tier NFRs by service criticality |
| **NFRs tested only before release** | Regressions discovered too late | Automate in CI, monitor continuously |
| **Ignoring trade-offs** | Conflicting NFRs cause paralysis or hidden compromises | Document trade-off decisions with rationale |
| **NFR scope creep** (raising targets without justification) | Unnecessary cost and complexity | Require business justification for target changes |
| **No baseline measurement** | Cannot tell if NFR is met or degrading | Measure current state before setting targets |

---

## Enforcement Checklist

- [ ] All NFR categories (ISO 25010) considered during project inception
- [ ] Every NFR has a measurable target with Must/Plan/Wish thresholds
- [ ] NFRs documented using structured template (Planguage or typed schema)
- [ ] Architecture decisions linked to driving NFRs in ADR format
- [ ] Trade-offs between conflicting NFRs documented with review dates
- [ ] Each NFR assigned to an owning team with clear accountability
- [ ] Automated NFR verification integrated into CI/CD pipeline
- [ ] NFR compliance dashboard visible to all team members
- [ ] NFR baselines reviewed and updated quarterly
- [ ] NFR testing plan defined for each category (load, security, a11y, etc.)
