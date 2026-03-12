# Platform Engineering & Internal Developer Platforms

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Team Organization |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [team-topologies.md](team-topologies.md), [engineering-culture.md](engineering-culture.md) |

---

## Core Concepts

### What Is Platform Engineering?

Platform engineering is the discipline of designing and building self-service toolchains and workflows that enable stream-aligned teams to deliver software independently. The platform team treats internal developers as its customers and provides golden paths -- opinionated, well-supported defaults that handle infrastructure, CI/CD, observability, and security concerns.

```
Without Platform Engineering:
  Developer → Write Terraform → Configure CI/CD → Set up monitoring
            → Configure secrets → Set up networking → Debug infra issues
  Result: 60% of time on undifferentiated heavy lifting

With Platform Engineering:
  Developer → `platform create service --template=go-api`
            → Automatic: CI/CD, infra, monitoring, secrets, networking
  Result: 90% of time on business logic
```

### When to Invest in Platform Engineering

| Signal | Indicator |
|--------|-----------|
| **Team count > 5** | Duplication of infrastructure work across teams |
| **Onboarding > 2 weeks** | New engineers spend weeks on environment setup |
| **Inconsistent practices** | Each team has different CI/CD, monitoring, deploy patterns |
| **Infrastructure bottleneck** | Central ops team is a queue for all infrastructure requests |
| **Compliance requirements** | Security and audit controls need standardized enforcement |

Do not build a platform prematurely. With 2-3 teams, shared scripts and documentation suffice. Platform investment pays off when the cost of inconsistency and duplication exceeds the cost of building the platform.

---

### Internal Developer Platforms (IDP)

An IDP is the concrete implementation of platform engineering. It provides a unified layer over infrastructure, tooling, and processes.

#### IDP Architecture Layers

```
+----------------------------------------------------------+
|  Developer Portal (UI/CLI)                                |
|  - Service catalog, docs, scorecards, templates           |
+----------------------------------------------------------+
|  Golden Paths & Templates                                 |
|  - Service scaffolding, CI/CD pipelines, IaC modules      |
+----------------------------------------------------------+
|  Platform APIs & Orchestration                            |
|  - Resource provisioning, environment management          |
+----------------------------------------------------------+
|  Infrastructure Layer                                     |
|  - Kubernetes, cloud services, databases, messaging       |
+----------------------------------------------------------+
```

#### Golden Paths

Define opinionated, paved-road defaults for common scenarios. Golden paths are the recommended way -- not the only way.

```yaml
# Example: Golden path service template
apiVersion: platform/v1
kind: ServiceTemplate
metadata:
  name: go-rest-api
spec:
  language: go
  framework: chi
  includes:
    - ci-cd: github-actions
    - containerization: dockerfile-multistage
    - observability: opentelemetry-auto
    - secrets: vault-sidecar
    - database: postgres-managed
    - monitoring: grafana-dashboards
  defaults:
    replicas: 2
    autoscaling:
      min: 2
      max: 10
      targetCPU: 70
    healthCheck:
      path: /healthz
      interval: 10s
```

#### Self-Service Infrastructure

Provide APIs and CLIs that let developers provision what they need without tickets.

```typescript
// Platform CLI example
interface PlatformCLI {
  // Create a new service from a template
  createService(opts: {
    name: string;
    template: "go-api" | "ts-api" | "python-ml" | "static-site";
    team: string;
    tier: "critical" | "standard" | "experimental";
  }): Promise<ServiceManifest>;

  // Provision a database
  createDatabase(opts: {
    name: string;
    engine: "postgres" | "mysql" | "mongodb";
    size: "small" | "medium" | "large";
    environment: "dev" | "staging" | "prod";
  }): Promise<DatabaseCredentials>;

  // Create a preview environment
  createPreviewEnv(opts: {
    branch: string;
    services: string[];
    ttl: string; // e.g., "48h"
  }): Promise<PreviewEnvironment>;
}
```

```python
# Platform API usage in CI/CD
import platform_sdk

client = platform_sdk.Client()

# Provision ephemeral environment for PR
env = client.environments.create(
    name=f"pr-{pr_number}",
    services=["checkout-api", "payment-service"],
    database_snapshot="staging-latest",
    ttl_hours=48,
)

print(f"Preview URL: {env.url}")
print(f"Expires: {env.expires_at}")
```

---

### Platform Tooling Landscape

| Tool | Category | Description |
|------|----------|-------------|
| **Backstage** (Spotify) | Developer portal | Service catalog, docs, scorecards, plugin ecosystem |
| **Port** | Developer portal | No-code portal builder, self-service actions, scorecards |
| **Cortex** | Developer portal | Service catalog with maturity scorecards |
| **Humanitec** | Platform orchestration | Dynamic config management, environment-as-code |
| **Kratix** | Platform framework | Kubernetes-native platform API framework |
| **Crossplane** | Infrastructure | Kubernetes-native infrastructure provisioning |
| **ArgoCD** | GitOps | Declarative continuous delivery for Kubernetes |

#### Backstage Example: Catalog Entity

```yaml
# catalog-info.yaml (placed in each service repo)
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: checkout-service
  description: Handles cart and payment processing
  annotations:
    github.com/project-slug: myorg/checkout-service
    pagerduty.com/service-id: PCHECKOUT
    grafana/dashboard-selector: "checkout"
  tags:
    - go
    - grpc
    - tier-1
spec:
  type: service
  lifecycle: production
  owner: team-checkout
  system: commerce
  dependsOn:
    - component:payment-gateway
    - resource:checkout-db
  providesApis:
    - checkout-api
```

---

### Platform as a Product

Treat the platform with the same rigor as a customer-facing product. Internal developers are the customers.

#### Product Management for Platforms

```
Platform Product Lifecycle:
  1. Discovery → Interview stream-aligned teams, observe pain points
  2. Prioritization → Rank by developer-hours saved * number of teams affected
  3. Build → MVP golden path, iterate based on adoption and feedback
  4. Launch → Documentation, training, migration support
  5. Measure → Adoption rate, satisfaction (NPS), time-to-first-deploy
  6. Iterate → Continuous improvement based on metrics and feedback
```

**Key principles:**
- Solve real problems observed in stream-aligned teams, not imagined ones
- Ship incremental improvements over big-bang platform releases
- Provide escape hatches -- golden paths are defaults, not mandates
- Maintain backward compatibility; breaking changes need migration paths
- Invest in documentation and onboarding as much as in code

---

### Measuring Platform Success

#### SPACE Framework Applied to Platforms

| Dimension | Metric | Target |
|-----------|--------|--------|
| **Satisfaction** | Developer NPS for platform tools | > 30 |
| **Performance** | Time from code commit to production | < 30 min |
| **Activity** | Deployments per team per week | > 5 |
| **Communication** | Support ticket volume (trending down) | < 5/team/month |
| **Efficiency** | Time to provision new service end-to-end | < 1 hour |

#### Additional Platform Metrics

```python
platform_metrics = {
    # Adoption
    "golden_path_adoption_rate": "% of new services using golden paths",
    "self_service_vs_ticket_ratio": "% of infra provisioned via self-service",

    # Developer experience
    "time_to_first_deploy": "Minutes from repo creation to first production deploy",
    "onboarding_time": "Days until new engineer ships first PR to production",
    "build_time_p95": "95th percentile CI/CD pipeline duration",

    # Reliability
    "platform_availability": "Uptime of platform services (target: 99.9%)",
    "incident_rate_platform": "Platform-caused incidents per month",

    # Efficiency
    "infra_cost_per_developer": "Cloud spend / number of engineers",
    "toil_reduction": "Hours of manual work eliminated per month",
}
```

---

### Platform Team Structure

#### Sizing Guidelines

| Org Size | Platform Team Size | Scope |
|----------|-------------------|-------|
| 20-50 eng | 2-3 engineers | Shared CI/CD, basic templates, documentation |
| 50-150 eng | 5-10 engineers | IDP, self-service infra, developer portal |
| 150-500 eng | 15-30 engineers | Full platform organization with sub-teams |
| 500+ eng | Platform division | Multiple platform teams (CI/CD, infra, DX, security) |

#### Sub-Team Specializations (at scale)

```
Platform Organization (150+ eng company):
  ├── Developer Experience Team
  │     Portal, CLI, templates, onboarding
  ├── Infrastructure Platform Team
  │     Kubernetes, networking, compute, storage
  ├── CI/CD Platform Team
  │     Build systems, deployment pipelines, preview environments
  ├── Data Platform Team
  │     Data pipelines, warehousing, ML infrastructure
  └── Security Platform Team
        Identity, secrets, compliance automation, scanning
```

---

## 10 Best Practices

1. **Treat the platform as a product.** Assign a product manager (or a tech lead with product mindset). Conduct user research with stream-aligned teams. Prioritize by impact.

2. **Start with golden paths, not mandates.** Provide opinionated defaults that teams want to use because they are easier than the alternative. Never force adoption through policy alone.

3. **Measure developer experience continuously.** Run quarterly developer surveys. Track SPACE metrics. Use the data to prioritize platform investments.

4. **Provide self-service with guardrails.** Let developers provision infrastructure through APIs and CLIs with built-in compliance, security, and cost controls.

5. **Document everything as code.** Templates, runbooks, architecture decisions -- all version-controlled. The portal should surface this documentation, not replace it.

6. **Invest in migration, not just creation.** When releasing new platform capabilities, budget 40% of effort for migrating existing services. Unmigrated services accumulate tech debt.

7. **Maintain backward compatibility.** Versioned APIs, deprecation notices with timelines, and automated migration tooling. Breaking changes erode trust.

8. **Build for the 80% case.** Golden paths serve common scenarios. Support escape hatches for the 20% that need customization. Do not block teams that need to deviate.

9. **Run the platform with production rigor.** Platform outages block every team. Apply SLOs, on-call rotations, incident management, and capacity planning to platform services.

10. **Show value through metrics.** Track time saved, deployment frequency improvements, and incident reduction. Present these to leadership quarterly.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Platform as gatekeeper** | Developers must file tickets and wait for platform to provision; creates bottleneck | Provide self-service APIs; platform enables, not controls |
| **Over-engineering the platform** | Building capabilities no team needs; complex abstractions | Start with observed pain points; build MVPs; validate adoption |
| **Unused abstractions** | Platform builds elegant abstractions nobody adopts | Interview users first; co-design with stream-aligned teams |
| **Mandated adoption without value** | Teams forced onto platform that makes their work harder | Earn adoption through developer experience; mandate only for compliance |
| **No product management** | Platform builds what is technically interesting, not what is needed | Assign product ownership; use roadmaps and user research |
| **Premature platform** | Building a platform for 3 teams; overhead exceeds benefit | Wait until duplication and inconsistency pain is real (5+ teams) |
| **Platform team in ivory tower** | No interaction with consuming teams; builds in isolation | Embed platform engineers with stream-aligned teams periodically |
| **Ignoring legacy** | Golden paths only for new services; existing services left behind | Budget migration effort; provide incremental adoption paths |

---

## Enforcement Checklist

- [ ] Platform team has a product roadmap informed by developer feedback
- [ ] Golden path templates exist for each primary language/framework
- [ ] New services can be created and deployed to staging in < 1 hour
- [ ] Self-service APIs exist for database, cache, queue, and environment provisioning
- [ ] Developer portal (Backstage or equivalent) catalogs all services and their owners
- [ ] Platform services have defined SLOs and on-call rotations
- [ ] Developer satisfaction survey runs quarterly with published results
- [ ] Documentation is versioned, searchable, and co-located with platform code
- [ ] Migration guides exist for every major platform version change
- [ ] Platform metrics dashboard is visible to engineering leadership
