# Team Topologies

| Attribute | Value |
|-----------|-------|
| Domain | Product Engineering > Team Organization |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [platform-teams.md](platform-teams.md), [engineering-culture.md](engineering-culture.md) |

---

## Core Concepts

### The Four Fundamental Team Types

Team Topologies (Skelton & Pais, 2019) defines four team types that compose an effective engineering organization. Limit team types to these four to reduce ambiguity and cognitive overhead.

#### 1. Stream-Aligned Team

The primary team type. Align each stream-aligned team to a single, valuable stream of work -- a product, service, feature set, user journey, or persona. This team has end-to-end ownership from ideation through production support.

**Characteristics:**
- Owns the full delivery lifecycle (design, build, test, deploy, operate)
- Minimizes handoffs to other teams
- Has clear, measurable business metrics
- Comprises 5-9 members (two-pizza rule)

```
Stream-Aligned Team: "Checkout Experience"
  Responsibilities:
  - Cart → Payment → Order confirmation flow
  - Owns checkout microservices, UI components, and data
  - On-call for checkout-related incidents
  - Tracks conversion rate, cart abandonment, checkout latency
```

#### 2. Enabling Team

Assist stream-aligned teams in adopting new capabilities. Enabling teams do not build features -- they uplift other teams through coaching, tooling guidance, and research.

**Characteristics:**
- Specialists in a domain (observability, testing, security, data)
- Engage temporarily with stream-aligned teams (weeks, not months)
- Measure success by how quickly teams become self-sufficient
- Detect gaps across the organization and close them proactively

#### 3. Complicated-Subsystem Team

Own a component that demands deep specialist knowledge (ML engine, video codec, financial calculation engine). Only create this team type when the cognitive load of the subsystem would overwhelm a stream-aligned team.

**Characteristics:**
- Provides its subsystem as a well-defined API or library
- Reduces cognitive load on consuming teams
- Requires rare, specialized expertise (PhD-level, domain-specific)

#### 4. Platform Team

Provide internal services that accelerate stream-aligned teams. Build self-service capabilities that reduce the cognitive load of infrastructure, tooling, and cross-cutting concerns.

**Characteristics:**
- Treat internal developers as customers
- Offer golden paths (opinionated, paved-road defaults)
- Provide self-service APIs, CLIs, and portals
- Measure adoption, developer satisfaction, and time-to-first-deploy

See [platform-teams.md](platform-teams.md) for in-depth coverage.

---

### Three Interaction Modes

Define explicit interaction modes between teams. Ambiguous team boundaries cause friction and dependencies.

#### 1. Collaboration

Two teams work closely together on a shared goal for a defined period. Use when discovering new approaches or integrating complex domains.

```
Collaboration Mode:
  Teams: "Search" + "ML Platform"
  Duration: 6 weeks
  Goal: Integrate vector search into product search
  Exit criteria: Search team can operate vector search independently
```

**When to use:** Discovery phases, new technology adoption, cross-domain integration.
**When to avoid:** Ongoing operations (creates blurred ownership).

#### 2. X-as-a-Service

One team provides a service that others consume via a well-defined API or interface. The consuming team does not need to understand internals.

```
X-as-a-Service Mode:
  Provider: "Platform Team" → Kubernetes namespace provisioning API
  Consumer: "Checkout Team" → calls API to create environments
  Contract: OpenAPI spec, SLA (99.9% availability, <5s provisioning)
```

**When to use:** Mature capabilities, clear interfaces, stable domains.
**When to avoid:** Early-stage exploration where requirements change rapidly.

#### 3. Facilitating

One team helps another learn or adopt a new skill. The facilitating team does not do the work -- it coaches, mentors, and removes blockers.

```
Facilitating Mode:
  Facilitator: "Observability Enabling Team"
  Facilitated: "Payments Team"
  Duration: 4 weeks
  Goal: Payments team can instrument services with OpenTelemetry
  Success: Facilitator disengages; Payments team operates independently
```

**When to use:** Skill transfer, adoption of new practices, temporary coaching.

---

### Cognitive Load and Team Sizing

#### Three Types of Cognitive Load

| Type | Definition | Goal |
|------|-----------|------|
| **Intrinsic** | Complexity inherent to the problem domain | Reduce through training and domain knowledge |
| **Extraneous** | Complexity from environment, tools, process | Eliminate through platform, tooling, automation |
| **Germane** | Complexity from learning and building mental models | Maximize -- this drives value |

#### Team Sizing Principles

- Limit team size to 5-9 people (Dunbar's number for working groups)
- Assign no more domains than the team can hold in working memory
- If a team needs a "deep expertise" wiki just to onboard, split the domain
- Platform teams reduce extraneous load so stream-aligned teams focus on germane load

```python
# Cognitive load assessment checklist
cognitive_load_signals = {
    "too_high": [
        "Team context-switches between >3 unrelated domains",
        "Onboarding takes >3 months to reach productivity",
        "Team members cannot explain each other's work areas",
        "PRs languish because only one person understands the code",
        "Incidents require paging multiple teams for diagnosis",
    ],
    "healthy": [
        "Any team member can review any PR within the team's scope",
        "New members contribute meaningful PRs within 2-4 weeks",
        "Team can independently deploy, monitor, and debug their services",
        "Team holds the full context needed for daily decisions",
    ],
}
```

---

### Conway's Law and the Inverse Conway Maneuver

#### Conway's Law (1968)

> "Any organization that designs a system will produce a design whose structure is a copy of the organization's communication structure."

This is not a suggestion -- it is an observation that holds in practice. If three backend teams build an API, expect three distinct API styles.

#### Inverse Conway Maneuver

Intentionally design team structures to produce the desired software architecture.

```
Current state:
  Team A (monolith frontend) ←→ Team B (monolith backend)
  Result: Monolithic architecture with tight coupling

Desired architecture:
  Independent microservices per business domain

Inverse Conway Maneuver:
  1. Create stream-aligned teams per domain (Checkout, Search, Catalog)
  2. Each team owns frontend + backend + data for their domain
  3. Architecture naturally evolves toward bounded-context services
```

**Steps to apply:**
1. Define the target architecture
2. Map required communication patterns
3. Restructure teams to match those patterns
4. Let the software architecture follow

---

### Evolution Patterns

Teams evolve as the organization scales. Recognize these transition points.

| Scale | Pattern | Typical Structure |
|-------|---------|-------------------|
| 1-10 eng | Single team | One cross-functional team, no specialization |
| 10-30 eng | Feature teams | 2-4 stream-aligned teams, shared platform responsibilities |
| 30-80 eng | Platform emergence | Dedicated platform team, enabling teams form |
| 80-200 eng | Team of teams | Multiple stream-aligned teams per domain, formal platform |
| 200+ eng | Federated model | Divisions/tribes, platform organization, governance |

---

### Real-World Models

#### Spotify Model (Squads, Tribes, Chapters, Guilds)

| Unit | Size | Purpose |
|------|------|---------|
| **Squad** | 6-12 | Autonomous, cross-functional team (like a mini-startup) |
| **Tribe** | Max ~100 | Collection of squads in a related area |
| **Chapter** | Varies | People with same skill across squads (e.g., all backend devs) |
| **Guild** | Varies | Cross-tribe community of interest (voluntary) |

**Caveats:** Spotify itself has evolved beyond this model. Do not cargo-cult it. Use it as inspiration, not prescription. The model works when autonomy is real and alignment mechanisms exist.

#### Amazon Two-Pizza Teams

- Each team is small enough to be fed by two pizzas (6-10 people)
- Teams own services end-to-end ("you build it, you run it")
- Teams write narratives (6-pagers) instead of slide decks for proposals
- APIs are the contracts between teams -- no backdoor integrations

---

## 10 Best Practices

1. **Start with stream-aligned teams.** Default to stream-aligned teams for 80%+ of your organization. Add other types only when stream-aligned teams experience excessive cognitive load.

2. **Make team boundaries explicit.** Document what each team owns, what it does not own, and how other teams should interact with it. Use a team API document.

3. **Limit cognitive load per team.** Assess whether each team can independently build, deploy, and operate its services. If not, reduce scope or provide platform support.

4. **Use interaction modes deliberately.** Declare and time-box collaboration periods. Default to X-as-a-Service for mature capabilities.

5. **Apply the Inverse Conway Maneuver.** Design team structures that produce the architecture you want, not the architecture you have.

6. **Evolve team structures as you scale.** Reassess topology at each doubling of engineering headcount. What works at 20 engineers breaks at 80.

7. **Keep teams stable.** Avoid frequent reorgs. Teams need 3-6 months to reach high performance. Reorganize only when there is a clear architectural or strategic reason.

8. **Measure team health, not just output.** Track cognitive load, deployment frequency, lead time, and team satisfaction alongside feature delivery.

9. **Avoid shared-services anti-pattern.** Shared teams that serve everyone become bottlenecks. Convert shared services into platform capabilities or distribute ownership.

10. **Respect Dunbar's numbers.** Use 5-9 for a working team, 15 for a trust group, 50 for a mutual recognition group, 150 for a social group. Size organizational units accordingly.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| **Component teams** (frontend team, backend team, QA team) | Handoffs, slow delivery, no end-to-end ownership | Reorganize into cross-functional stream-aligned teams |
| **Shared services bottleneck** | Every team depends on one team, creating queues | Convert to platform (self-service) or distribute ownership |
| **Cargo-culting Spotify model** | Adopting labels without underlying autonomy | Implement the principles (autonomy, alignment) not the labels |
| **Constant reorganization** | Teams never reach performing stage; morale drops | Reorganize only with clear rationale; allow 6+ months of stability |
| **Team owns too many services** | Cognitive overload, slow onboarding, high incident fatigue | Split team or offload services to platform |
| **No explicit interaction modes** | Blurred ownership, duplicated effort, integration conflicts | Declare collaboration, X-as-a-Service, or facilitating per pair |
| **Ignoring Conway's Law** | Architecture drifts to match org chart, not design intent | Apply Inverse Conway Maneuver proactively |
| **Over-indexing on utilization** | People spread across teams at 20% allocation; no ownership | Assign people to one team full-time; utilization is not productivity |

---

## Enforcement Checklist

- [ ] Every engineer belongs to exactly one team (no fractional allocation)
- [ ] Each team has a documented Team API (ownership, interfaces, communication)
- [ ] Team size is between 5 and 9 members
- [ ] Cognitive load assessed quarterly per team
- [ ] Interaction modes between teams are explicitly declared and time-boxed
- [ ] Stream-aligned teams own deploy, monitor, and on-call for their services
- [ ] Platform capabilities are self-service with documented SLAs
- [ ] Team topology reviewed at each major headcount milestone
- [ ] Architecture diagrams reflect team boundaries (Inverse Conway check)
- [ ] No team has a dependency queue longer than one sprint
