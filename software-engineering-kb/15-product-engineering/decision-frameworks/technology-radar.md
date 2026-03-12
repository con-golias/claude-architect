# Technology Radar & Evaluation

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Decision Frameworks |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Build vs Buy](build-vs-buy.md), [RFC Process](rfc-process.md), [Tech Debt Prevention](../../13-code-quality/technical-debt/prevention.md) |

---

## Core Concepts

### ThoughtWorks Technology Radar Model

The Technology Radar is a visualization tool for tracking technology adoption across an organization. Originally created by ThoughtWorks, it categorizes technologies into quadrants and rings.

**Quadrants (What):**

| Quadrant | Covers | Examples |
|----------|--------|----------|
| **Techniques** | Practices, methodologies, architectural patterns | Trunk-based development, CQRS, micro frontends |
| **Tools** | Software tools for development, testing, deployment | k6, Playwright, Terraform, Renovate |
| **Platforms** | Infrastructure, cloud services, managed platforms | AWS Lambda, Cloudflare Workers, PlanetScale |
| **Languages & Frameworks** | Programming languages, frameworks, libraries | Go, Rust, Next.js, FastAPI, htmx |

**Rings (Adoption Level):**

| Ring | Meaning | Action |
|------|---------|--------|
| **Adopt** | Proven; use by default for appropriate problems | Standardize; include in starter templates |
| **Trial** | Promising; use in non-critical projects to build experience | Run in 1-2 production services; report results |
| **Assess** | Worth exploring; understand how it fits your context | Time-boxed PoC or spike; no production use |
| **Hold** | Do not start new work with this; actively migrate away | Sunset plan required; no new adoption |

### Building Your Own Radar

**Process:**

```
1. GATHER INPUT (Ongoing)
   - Engineers submit technology nominations via form or PR
   - Include: technology name, quadrant, proposed ring, rationale

2. REVIEW COMMITTEE (Quarterly)
   - 5-8 senior engineers from diverse teams
   - Review all nominations against evaluation criteria
   - Debate placement; aim for rough consensus

3. PUBLISH (Quarterly)
   - Update the radar visualization
   - Write blips (short explanations for each change)
   - Present at engineering all-hands

4. ENFORCE (Continuous)
   - New projects must choose from Adopt/Trial rings
   - Assess technologies need an RFC for production use
   - Hold technologies need a migration plan
```

**Radar Update Cadence:**
- Full radar review: Quarterly
- Emergency additions (critical vulnerabilities, major releases): Ad-hoc
- Deprecation announcements: With 6-month migration timeline

### Technology Evaluation Criteria

Score each technology on these dimensions before placing it on the radar.

| Criterion | Weight | Questions to Ask |
|-----------|--------|-----------------|
| **Maturity** | High | How long in production at other companies? Stable API? Past v1.0? |
| **Community & Ecosystem** | High | Active contributors? Growing or shrinking? Quality of plugins/libraries? |
| **Team Skills** | High | Do we have expertise? What is the learning curve? Hiring market? |
| **Problem Fit** | Critical | Does it solve our specific problem better than current tools? |
| **Total Cost of Ownership** | High | License cost + infrastructure + training + maintenance + migration? |
| **Integration** | Medium | How well does it fit our existing stack? API compatibility? |
| **Vendor Risk** | Medium | Single vendor? Open-source? Risk of acquisition/abandonment? |
| **Security & Compliance** | High | Meets our security requirements? SOC2/GDPR compatible? |
| **Performance** | Medium | Benchmarks for our use case? Scales to our requirements? |
| **Operational Complexity** | Medium | Easy to deploy, monitor, debug? Observable? |

**Scoring Template (TypeScript):**

```typescript
// evaluation/scoring.ts
interface TechEvaluation {
  name: string;
  quadrant: "techniques" | "tools" | "platforms" | "languages-frameworks";
  proposedRing: "adopt" | "trial" | "assess" | "hold";
  scores: EvaluationScores;
  evaluatedBy: string;
  evaluatedAt: Date;
}

interface EvaluationScores {
  maturity: Score;
  community: Score;
  teamSkills: Score;
  problemFit: Score;
  totalCostOfOwnership: Score;
  integration: Score;
  vendorRisk: Score;
  security: Score;
  performance: Score;
  operationalComplexity: Score;
}

interface Score {
  value: 1 | 2 | 3 | 4 | 5; // 1=poor, 5=excellent
  notes: string;
}

function weightedScore(scores: EvaluationScores): number {
  const weights: Record<keyof EvaluationScores, number> = {
    maturity: 3,
    community: 3,
    teamSkills: 3,
    problemFit: 4,    // Highest weight
    totalCostOfOwnership: 3,
    integration: 2,
    vendorRisk: 2,
    security: 3,
    performance: 2,
    operationalComplexity: 2,
  };

  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += scores[key as keyof EvaluationScores].value * weight;
    weightSum += weight;
  }
  return Math.round((total / weightSum) * 100) / 100;
}

function recommendRing(score: number): string {
  if (score >= 4.0) return "adopt";
  if (score >= 3.0) return "trial";
  if (score >= 2.0) return "assess";
  return "hold";
}
```

### Proof of Concept (PoC) Methodology

Run structured, time-boxed PoCs before moving technology from Assess to Trial.

**PoC Framework:**

```
PoC: [Technology Name]
Duration: [1-2 weeks maximum]
Team: [2-3 engineers]
Sponsor: [Engineering manager or architect]

OBJECTIVES
- [ ] Validate claim 1: [specific technical hypothesis]
- [ ] Validate claim 2: [specific technical hypothesis]
- [ ] Evaluate integration with [existing system X]

EVALUATION RUBRIC
| Criterion           | Must Have | Nice to Have | Result |
|---------------------|-----------|-------------|--------|
| Handles 10K rps     |     X     |             |        |
| < 50ms p99 latency  |     X     |             |        |
| TypeScript SDK       |           |      X      |        |
| Self-hostable       |     X     |             |        |

DELIVERABLES
- Working prototype exercising key use case
- Performance benchmarks against current solution
- Integration complexity assessment (hours to production)
- Go/No-Go recommendation with evidence

CONSTRAINTS
- Use real-world data (anonymized production sample)
- Test failure modes (network partition, high load)
- Do NOT polish -- focus on learning, not production quality
```

**PoC Execution (Go example - evaluating a new database):**

```go
// poc/database_eval_test.go
package poc

import (
    "context"
    "testing"
    "time"
)

func BenchmarkInsertThroughput(b *testing.B) {
    ctx := context.Background()
    db := setupCandidate(ctx) // Connect to candidate DB
    defer db.Close()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _ = db.Insert(ctx, generateTestRecord(i))
    }
}

func BenchmarkQueryLatency(b *testing.B) {
    ctx := context.Background()
    db := setupCandidate(ctx)
    defer db.Close()
    seedData(ctx, db, 100_000) // Realistic data volume

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = db.Query(ctx, randomQueryParams())
    }
}

func TestFailureRecovery(t *testing.T) {
    ctx := context.Background()
    db := setupCandidate(ctx)
    defer db.Close()

    // Simulate network partition
    simulatePartition(db, 5*time.Second)

    // Verify recovery
    err := db.Insert(ctx, generateTestRecord(1))
    if err != nil {
        t.Fatalf("Failed to recover after partition: %v", err)
    }
}
```

### Technology Lifecycle Management

Every technology follows a lifecycle within the organization.

```
ASSESS --> TRIAL --> ADOPT --> STANDARDIZE --> DEPRECATE --> REMOVE
  |          |         |           |               |            |
  |          |         |           |               |            +-- Code deleted,
  |          |         |           |               |                infra removed
  |          |         |           |               |
  |          |         |           |               +-- Migration plan active;
  |          |         |           |                   no new usage allowed
  |          |         |           |
  |          |         |           +-- In starter templates;
  |          |         |               default choice for use case
  |          |         |
  |          |         +-- Approved for production;
  |          |             multiple teams using
  |          |
  |          +-- 1-2 production services;
  |              learning phase
  |
  +-- PoC/spike only;
      no production use
```

**Deprecation Policy:**
- Announce deprecation at least 6 months before removal
- Provide migration guide with code examples
- Assign migration shepherd to assist teams
- Track migration progress on a dashboard
- Only remove after all production usage is migrated

### Governance: Approved Technology List

Maintain a living document of approved technologies per use case.

| Use Case | Adopt (Default) | Trial (Approved) | Hold (Migrate Away) |
|----------|----------------|-------------------|---------------------|
| Backend API | Go, TypeScript (Node) | Rust | Python (for APIs) |
| Frontend | React, Next.js | Svelte, Astro | Angular, jQuery |
| Database (relational) | PostgreSQL | CockroachDB | MySQL |
| Database (document) | MongoDB (Atlas) | -- | CouchDB |
| Message Queue | Kafka | NATS | RabbitMQ |
| CI/CD | GitHub Actions | Dagger | Jenkins |
| IaC | Terraform | Pulumi | CloudFormation |
| Monitoring | Datadog | Grafana Cloud | New Relic |

**Exception Process:**
1. Engineer files an RFC explaining why approved tech does not fit
2. RFC reviewed by architecture team within 5 business days
3. If approved, exception is granted with scope and expiration date
4. Exception tracked on radar as "Trial" with conditions

### Radar Visualization Tools

| Tool | Type | Features |
|------|------|----------|
| **Zalando Tech Radar** | Open-source (JS) | Static site generator; simple JSON config |
| **Backstage TechDocs** | Open-source (CNCF) | Service catalog with tech metadata |
| **ThoughtWorks Build Your Own Radar** | Free tool | Upload CSV/JSON; generates radar visualization |
| **Custom (D3.js)** | Build your own | Full control over visualization and interactivity |

---

## Best Practices

1. **Update the radar quarterly, not annually.** Technology moves fast. A stale radar is worse than no radar because it gives false confidence in outdated guidance.
2. **Involve engineers from diverse teams.** The review committee must include backend, frontend, platform, data, and security perspectives to avoid blind spots.
3. **Write a blip for every ring change.** A one-paragraph explanation for why a technology moved rings builds understanding and trust in the process.
4. **Time-box all PoCs to 1-2 weeks.** Longer PoCs become stealth projects. Constrain scope to answering specific questions, not building production systems.
5. **Evaluate total cost of ownership, not just license fees.** Training, migration, operational complexity, and hiring difficulty often dwarf license costs.
6. **Require an RFC for any technology not on the Adopt ring.** This ensures review and prevents shadow adoption of unvetted technologies.
7. **Maintain a deprecation timeline for Hold technologies.** "Hold" without a migration plan is an unfunded mandate. Allocate engineering time to migrate.
8. **Celebrate successful technology removals.** Reducing the technology surface area is as valuable as adopting new tools. Make deprecation completions visible.
9. **Publish the radar to the entire organization.** Non-engineers (product, design, leadership) benefit from understanding the technology landscape and investment areas.
10. **Connect radar decisions to hiring and training.** If you move a technology to Adopt, invest in training. If you move it to Hold, adjust hiring profiles accordingly.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Radar published once, never updated | Stale guidance; teams ignore the radar | Quarterly review cadence with assigned owner |
| No enforcement of Hold ring | Deprecated tech keeps growing; migration debt compounds | Block new usage in CI; require RFC for exceptions |
| Resume-driven adoption | Technology chosen for engineer excitement, not problem fit | Require PoC with evaluation rubric before Trial |
| Radar without blips (just dots on a chart) | No context; teams do not understand why decisions were made | Write 1-paragraph explanation for every ring change |
| Committee of one | Single architect's biases dominate | Diverse review committee (5-8 engineers) |
| No exception process | Teams feel blocked; work around the radar secretly | Define a clear, lightweight exception path via RFC |
| Ignoring operational readiness | Adopt technology before infra, monitoring, runbooks exist | Require operational readiness checklist before Adopt |
| Too many technologies on Trial | No team has depth in anything; support burden spreads thin | Limit Trial ring to 3-5 per quadrant at a time |

---

## Enforcement Checklist

- [ ] Technology radar published and accessible to all engineering
- [ ] Quarterly review cadence scheduled with diverse committee
- [ ] Blip written for every ring change with rationale
- [ ] Approved technology list per use case maintained
- [ ] PoC template and rubric available for Assess evaluations
- [ ] RFC required for production use of non-Adopt technologies
- [ ] Deprecation policy defined with 6-month minimum timeline
- [ ] Exception process documented and accessible
- [ ] Migration progress dashboard for Hold technologies
- [ ] Radar decisions linked to training and hiring plans
