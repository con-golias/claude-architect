# Build vs Buy Decision Framework

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Decision Frameworks |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Technology Radar](technology-radar.md), [RFC Process](rfc-process.md) |

---

## Core Concepts

### Decision Framework

The build vs buy decision determines whether to create a capability in-house or purchase/adopt an external solution. This is one of the highest-leverage decisions a team makes because it determines where engineering effort is allocated for years.

**Core Principle:** Build what differentiates you; buy what is commodity. If a capability is central to your competitive advantage, build it. If it is infrastructure that every company needs, buy or adopt.

**Three-Part Analysis:**

| Factor | Build Indicator | Buy Indicator |
|--------|----------------|---------------|
| **Core Competency** | Central to your product's unique value | Table-stakes capability every company needs |
| **Strategic Differentiation** | Custom solution gives competitive edge | No competitive advantage from custom solution |
| **Total Cost of Ownership** | Long-term cost lower when amortized over team/scale | Build cost exceeds vendor cost over 3-5 years |

### Build Advantages

| Advantage | Description |
|-----------|-------------|
| **Full Control** | Customize to exact needs; no feature gaps or workarounds |
| **No Vendor Lock-in** | No risk of vendor price increases, API changes, or shutdown |
| **Competitive Moat** | Proprietary technology others cannot easily replicate |
| **Deep Integration** | Seamless fit with existing architecture and workflows |
| **Data Ownership** | Complete control over data storage, processing, and privacy |
| **Iteration Speed** | Change priorities without waiting for vendor roadmap |

### Buy Advantages

| Advantage | Description |
|-----------|-------------|
| **Faster Time to Market** | Deploy in days/weeks instead of months |
| **Maintained by Vendor** | Security patches, updates, and improvements included |
| **Proven at Scale** | Battle-tested by thousands of customers |
| **Lower Initial Cost** | No upfront engineering investment |
| **Broader Expertise** | Vendor specializes in this domain; deeper knowledge |
| **Reduced Hiring Pressure** | No need to hire and retain specialists for this domain |

### Open-Source: The Third Option

Open-source sits between build and buy. Evaluate it as a distinct option.

| Factor | Consideration |
|--------|--------------|
| **Community Health** | Contributors, commit frequency, issue response time, governance model |
| **License** | MIT/Apache (permissive) vs GPL/AGPL (copyleft) -- AGPL requires sharing modifications |
| **Maintenance Burden** | You own upgrades, security patches, and operational support |
| **Fork Risk** | If project is abandoned, can your team maintain a fork? |
| **Support Options** | Commercial support available? (e.g., Red Hat for Linux, Confluent for Kafka) |

**License Quick Reference:**

| License | Can Use Commercially | Must Share Changes | Can Sublicense | Notes |
|---------|---------------------|-------------------|----------------|-------|
| **MIT** | Yes | No | Yes | Most permissive |
| **Apache 2.0** | Yes | No | Yes | Includes patent grant |
| **BSD** | Yes | No | Yes | Similar to MIT |
| **GPL v3** | Yes | Yes (if distributed) | Copyleft | Viral for distributed software |
| **AGPL v3** | Yes | Yes (if network-accessible) | Copyleft | Viral for SaaS/web apps |
| **BSL / SSPL** | Limited | Varies | No | "Source available" -- not truly open-source |

### TCO Calculation

Calculate Total Cost of Ownership over 3-5 years for a fair comparison.

```typescript
// decisions/tco.ts
interface TCOBuild {
  initialDevelopment: number;      // Engineering cost to build v1
  ongoingMaintenance: number;      // Annual maintenance (20-30% of initial)
  infrastructure: number;          // Annual hosting, compute, storage
  opportunityCost: number;         // Value of features NOT built during dev
  hiringCost: number;              // Cost to hire/retain specialists
  securityAudits: number;          // Annual security review cost
}

interface TCOBuy {
  licenseFee: number;              // Annual license or subscription
  integrationCost: number;         // One-time integration engineering
  customizationCost: number;       // Workarounds for missing features
  dataMigrationCost: number;       // One-time migration cost
  trainingCost: number;            // Team onboarding
  vendorManagementCost: number;    // Contract negotiation, reviews
  exitCost: number;                // Cost to migrate away if needed
}

function calculateTCO(
  build: TCOBuild,
  buy: TCOBuy,
  years: number = 3
): { buildTotal: number; buyTotal: number; recommendation: string } {
  const buildTotal =
    build.initialDevelopment +
    build.opportunityCost +
    build.hiringCost +
    (build.ongoingMaintenance + build.infrastructure +
     build.securityAudits) * years;

  const buyTotal =
    buy.integrationCost +
    buy.customizationCost +
    buy.dataMigrationCost +
    buy.trainingCost +
    buy.exitCost +
    (buy.licenseFee + buy.vendorManagementCost) * years;

  const diff = Math.abs(buildTotal - buyTotal);
  const threshold = Math.min(buildTotal, buyTotal) * 0.2;

  let recommendation: string;
  if (diff < threshold) {
    recommendation = "Close call -- decide based on strategic factors";
  } else if (buildTotal < buyTotal) {
    recommendation = "Build (lower TCO)";
  } else {
    recommendation = "Buy (lower TCO)";
  }

  return { buildTotal, buyTotal, recommendation };
}
```

### Evaluation Checklist

Score each dimension 1-5 for both Build and Buy options.

| Dimension | Build Score | Buy Score | Weight | Notes |
|-----------|-----------|-----------|--------|-------|
| Functionality Fit | How much can we customize? | How well does it match needs out-of-box? | High | |
| Integration Complexity | Native to our stack | API/SDK quality, auth compatibility | High | |
| Time to Production | Months | Days/weeks | High | |
| Vendor Viability | N/A | Company stage, funding, customer base | Medium | |
| Data Portability | Full ownership | Export capabilities, standard formats | High | |
| SLA Guarantees | Internal SLA | Contractual uptime commitments | Medium | |
| Security & Compliance | Full audit control | SOC2, GDPR, penetration test reports | High | |
| Scalability | Architect for your needs | Vendor handles scaling | Medium | |
| Team Expertise | Existing or hire-able | Vendor handles domain complexity | Medium | |
| Lock-in Risk | None | Migration difficulty if switching | High | |

### Common Build vs Buy Decisions

| Domain | Build When | Buy When | Common Vendors |
|--------|-----------|----------|----------------|
| **Authentication** | Auth is core differentiator; extreme customization needed | Standard auth flows suffice; want quick setup | Auth0, Clerk, Firebase Auth, Supertokens |
| **Payments** | Payment processing IS your product | Standard payment acceptance | Stripe, Adyen, Square |
| **Email/Notifications** | Delivery infrastructure is your product | Need reliable transactional email | SendGrid, Resend, Postmark, Novu |
| **Search** | Search quality is core differentiator | Need basic search functionality | Algolia, Typesense, Meilisearch, Elasticsearch |
| **CMS** | Highly custom content model | Standard content management needs | Contentful, Sanity, Strapi |
| **Monitoring** | Observability platform is your product | Need standard APM/logging | Datadog, Grafana Cloud, New Relic |
| **Feature Flags** | Deep experiment platform needed | Standard feature flag management | LaunchDarkly, Statsig, Unleash |
| **CI/CD** | Unique build/deploy requirements | Standard build and deploy pipelines | GitHub Actions, CircleCI, Buildkite |

### Decision Matrix (Python)

```python
# decisions/build_vs_buy.py
from dataclasses import dataclass
from enum import Enum

class Recommendation(Enum):
    BUILD = "build"
    BUY = "buy"
    OPEN_SOURCE = "open_source"
    HYBRID = "hybrid"

@dataclass
class EvaluationCriteria:
    core_competency: bool       # Is this central to our product?
    competitive_advantage: bool  # Does custom solution give an edge?
    team_expertise: int          # 1-5: existing team skill level
    time_pressure: int           # 1-5: urgency (5 = ship yesterday)
    customization_needed: int    # 1-5: how much must it be tailored
    vendor_options: int          # Number of viable vendors
    budget_annual: float         # Available annual budget
    build_estimate_months: int   # Estimated months to build v1
    maintenance_capacity: bool   # Team can maintain long-term?

def recommend(criteria: EvaluationCriteria) -> Recommendation:
    score = 0  # Positive = build; negative = buy

    # Core competency is the strongest signal
    if criteria.core_competency:
        score += 3
    if criteria.competitive_advantage:
        score += 2

    # Team and capacity
    if criteria.team_expertise >= 4:
        score += 1
    elif criteria.team_expertise <= 2:
        score -= 2

    if criteria.maintenance_capacity:
        score += 1
    else:
        score -= 2

    # Time pressure favors buying
    if criteria.time_pressure >= 4:
        score -= 2
    elif criteria.time_pressure <= 2:
        score += 1

    # High customization favors building
    if criteria.customization_needed >= 4:
        score += 2
    elif criteria.customization_needed <= 2:
        score -= 1

    # Vendor market
    if criteria.vendor_options == 0:
        score += 3  # No choice but to build
    elif criteria.vendor_options >= 3:
        score -= 1  # Healthy vendor market

    # Long build time favors buying
    if criteria.build_estimate_months > 6:
        score -= 1

    if score >= 3:
        return Recommendation.BUILD
    elif score <= -2:
        return Recommendation.BUY
    elif criteria.vendor_options == 0 and not criteria.core_competency:
        return Recommendation.OPEN_SOURCE
    else:
        return Recommendation.HYBRID

# Example: Evaluating authentication solution
auth_eval = EvaluationCriteria(
    core_competency=False,
    competitive_advantage=False,
    team_expertise=3,
    time_pressure=4,
    customization_needed=2,
    vendor_options=5,
    budget_annual=50_000,
    build_estimate_months=4,
    maintenance_capacity=False,
)
print(recommend(auth_eval))  # Recommendation.BUY
```

### Migration Strategy: Switching from Buy to Build (or Vice Versa)

Decisions are not permanent. Plan for transitions.

**Buy-to-Build Migration (Typical when scaling up):**

```
1. IDENTIFY TRIGGER
   - Vendor costs exceed build + maintain cost
   - Missing features blocking product roadmap
   - Vendor reliability or security concerns
   - Acquisition or EOL announcement

2. BUILD ALONGSIDE (Strangler Pattern)
   - Build the replacement behind a feature flag
   - Route 5% of traffic to new system
   - Compare behavior and performance

3. GRADUAL MIGRATION
   - Increase traffic to new system incrementally (5% -> 25% -> 50% -> 100%)
   - Keep vendor as fallback during migration
   - Migrate historical data in batches

4. CUT OVER
   - Route 100% to new system
   - Keep vendor contract active for 1 month (safety net)
   - Cancel vendor contract after validation period

5. CLEAN UP
   - Remove vendor SDK and integration code
   - Update documentation and runbooks
   - Archive migration logs
```

**Build-to-Buy Migration (Typical when refocusing):**

```
1. IDENTIFY TRIGGER
   - Maintenance burden exceeds vendor cost
   - Team capacity needed for core product work
   - In-house solution falling behind industry standard

2. VENDOR EVALUATION
   - Score vendors using evaluation checklist
   - PoC with top 2-3 candidates
   - Negotiate contract with data portability clause

3. DATA MIGRATION
   - Map internal schema to vendor schema
   - Write migration scripts; test on staging
   - Validate data integrity post-migration

4. INTEGRATION SWAP
   - Use adapter pattern: swap implementation behind interface
   - Feature flag the vendor integration
   - Run both systems in parallel during validation

5. DECOMMISSION
   - Remove internal implementation after confidence period
   - Delete associated infrastructure
   - Redirect internal documentation to vendor docs
```

**Adapter Pattern for Vendor Swaps (TypeScript):**

```typescript
// services/auth/interface.ts - Stable interface
interface AuthService {
  authenticate(email: string, password: string): Promise<AuthResult>;
  verifyToken(token: string): Promise<UserClaims>;
  revokeToken(token: string): Promise<void>;
}

// services/auth/internal.ts - In-house implementation
class InternalAuthService implements AuthService {
  async authenticate(email: string, password: string) { /* ... */ }
  async verifyToken(token: string) { /* ... */ }
  async revokeToken(token: string) { /* ... */ }
}

// services/auth/clerk.ts - Vendor implementation
class ClerkAuthService implements AuthService {
  async authenticate(email: string, password: string) { /* ... */ }
  async verifyToken(token: string) { /* ... */ }
  async revokeToken(token: string) { /* ... */ }
}

// services/auth/factory.ts - Swap via configuration
function createAuthService(): AuthService {
  if (config.authProvider === "clerk") {
    return new ClerkAuthService();
  }
  return new InternalAuthService();
}
```

---

## Best Practices

1. **Default to buy for non-core capabilities.** Engineering time is your scarcest resource. Spend it on what makes your product unique, not on reinventing authentication or email delivery.
2. **Calculate TCO over 3-5 years, not just initial cost.** Building looks cheap until you add ongoing maintenance (20-30% of build cost annually), security audits, and opportunity cost.
3. **Always evaluate open-source as a third option.** Open-source can offer the control of building with lower initial investment. Factor in maintenance burden and community health.
4. **Wrap vendor integrations behind an interface.** Use the adapter pattern so you can swap vendors or switch to in-house without rewriting consuming code.
5. **Include data portability in vendor contracts.** Before signing, verify you can export all your data in a standard format. No data portability means permanent lock-in.
6. **Re-evaluate build vs buy decisions annually.** What made sense at 10 engineers may not make sense at 100. Revisit as team size, scale, and strategy evolve.
7. **Prototype before committing to build.** If leaning toward build, invest 1-2 weeks in a prototype to validate complexity estimates. Engineers chronically underestimate build effort.
8. **Check vendor viability signals.** Revenue, funding, customer count, executive team stability, and response time to support tickets all signal long-term viability.
9. **Plan for migration from day one.** Whether building or buying, design the integration so you can switch. Assume the decision will be revisited in 2-3 years.
10. **Document the decision with an RFC and ADR.** Record the context, analysis, and rationale. Future engineers will ask "why did we build this?" or "why did we buy that?" -- give them the answer.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| "Not Invented Here" syndrome | Build everything in-house regardless of fit | Use decision framework; default to buy for non-core |
| Vendor lock-in without exit plan | Cannot switch when vendor raises prices or degrades | Wrap behind interfaces; require data portability clause |
| Underestimating build maintenance | Initial build is 30% of total cost; maintenance is 70% | Include 3-5 year maintenance in TCO calculation |
| Buying for core differentiators | Competitor parity; no unique value | Build what differentiates; buy everything else |
| Ignoring open-source options | Pay vendor for something open-source does well | Always evaluate open-source before buying |
| No evaluation criteria (gut feeling) | Inconsistent, biased decisions | Use standardized scoring matrix for every decision |
| Selecting vendor based only on features | Ignore integration cost, vendor viability, lock-in | Score across all dimensions; weight strategic factors |
| Never re-evaluating past decisions | Outgrown vendor or over-engineered build stays forever | Annual review of build/buy decisions |

---

## Enforcement Checklist

- [ ] Decision framework (build vs buy vs open-source) documented and adopted
- [ ] TCO calculation template available (3-5 year horizon)
- [ ] Evaluation scoring matrix used for all significant decisions
- [ ] Vendor integrations wrapped behind interfaces (adapter pattern)
- [ ] Data portability clause required in all vendor contracts
- [ ] Open-source license review process defined (legal sign-off for copyleft)
- [ ] RFC required for any build decision estimated at > 2 engineer-months
- [ ] Annual review of existing build vs buy decisions scheduled
- [ ] Migration playbook available (buy-to-build and build-to-buy)
- [ ] Past decisions documented as ADRs with context and rationale
