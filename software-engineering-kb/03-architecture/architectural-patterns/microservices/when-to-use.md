# Microservices: When to Use — Complete Specification

> **AI Plugin Directive:** Microservices are NOT the default architecture. They are a TRADE-OFF: you gain independent deployment and scaling but pay with operational complexity, network latency, and distributed data management. ONLY adopt microservices when the benefits demonstrably outweigh the costs for YOUR specific situation. The default starting point for any new system is a well-structured modular monolith.

---

## 1. The Decision Framework

### When Microservices ARE the Right Choice

```
ALL of these conditions must be true:

✅ TEAM SIZE: More than 20 developers working on the same system
   → Small teams get ZERO benefit from microservices
   → Microservices solve the problem of TEAM coordination, not technical complexity

✅ INDEPENDENT DEPLOYMENT NEED: Different parts of the system need different release cadences
   → Team A deploys 5 times/day, Team B deploys weekly
   → If everyone deploys on the same schedule, you don't need microservices

✅ DIFFERENT SCALING REQUIREMENTS: Parts of the system have wildly different load profiles
   → Search handles 10,000 req/sec, Ordering handles 100 req/sec
   → If everything scales the same, you don't need microservices

✅ DEVOPS MATURITY: Your organization has automated CI/CD, container orchestration,
   monitoring, and on-call rotation
   → Without these, microservices will be a disaster
   → You need at least 6 months of DevOps investment before microservices

✅ DOMAIN UNDERSTANDING: You deeply understand your business domain and can draw
   clear bounded context boundaries
   → If you're building an MVP, you DON'T understand your domain yet
   → Wrong boundaries are 10x harder to fix than wrong code
```

### When Microservices ARE NOT the Right Choice

```
ANY of these conditions makes microservices wrong:

❌ SMALL TEAM: Fewer than 10 developers
   → The coordination overhead exceeds the benefit
   → 3 developers managing 10 services is absurd

❌ NEW PRODUCT / MVP: You're still discovering what to build
   → You WILL draw wrong boundaries
   → Pivoting is 10x harder with microservices

❌ NO DEVOPS: You don't have automated deployment, monitoring, or containerization
   → You will spend all your time on infrastructure, zero on features

❌ RESUME-DRIVEN DEVELOPMENT: "Netflix uses microservices, so should we"
   → Netflix has 2,000+ engineers. You have 8.

❌ UNIFORM SCALING: Everything scales the same way
   → A monolith with horizontal scaling is simpler and cheaper

❌ SIMPLE DOMAIN: Your application is a CRUD app with no complex business logic
   → A monolith is the correct architecture for most applications

❌ TIGHT DEADLINE: You need to ship in 3 months
   → Microservices are slower to develop initially
   → A monolith ships faster for greenfield projects
```

---

## 2. The Complete Decision Tree

```
START HERE: What are you building?

Is this a NEW product (< 1 year old)?
├── YES → Build a MODULAR MONOLITH
│         → Extract microservices later when boundaries are proven
│         → Even Amazon started as a monolith
└── NO → Continue ↓

How many developers work on this system?
├── < 10 → MODULAR MONOLITH
│          → Microservices add overhead you can't afford
├── 10-30 → Consider HYBRID approach
│           → Core as modular monolith
│           → Extract 2-3 services with clear independent needs
└── > 30 → Continue ↓

Do different parts need independent deployment?
├── NO → MODULAR MONOLITH with clear module boundaries
└── YES → Continue ↓

Do you have mature DevOps?
├── NO → INVEST IN DEVOPS FIRST
│        → CI/CD, monitoring, containerization, alerting
│        → Then revisit microservices in 6 months
└── YES → Continue ↓

Can you clearly define bounded contexts?
├── NO → Run Event Storming workshops first
│        → Define boundaries BEFORE coding
└── YES → MICROSERVICES are appropriate
          → Start by extracting the most independent bounded context
          → Use Strangler Fig pattern if migrating from monolith
```

---

## 3. Architecture Comparison Matrix

```
┌────────────────────────┬─────────────┬──────────────────┬──────────────────┐
│ Factor                 │ Monolith    │ Modular Monolith │ Microservices    │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Initial development    │ Fastest     │ Fast             │ Slowest          │
│ speed                  │             │                  │                  │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Deployment complexity  │ Simple      │ Simple           │ Complex          │
│                        │ (1 unit)    │ (1 unit)         │ (N units)        │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Team scalability       │ Poor        │ Good             │ Excellent        │
│ (30+ developers)       │ (conflicts) │ (module ownership│ (full autonomy)  │
│                        │             │  helps)          │                  │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Independent deployment │ No          │ No               │ Yes              │
│                        │             │ (but modules     │ (each service    │
│                        │             │  can have own    │  deploys alone)  │
│                        │             │  test suites)    │                  │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Independent scaling    │ No          │ No               │ Yes              │
│                        │ (scale all) │ (scale all)      │ (scale each)     │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Technology diversity   │ One stack   │ One stack        │ Any stack per    │
│                        │             │                  │ service          │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Operational complexity │ Low         │ Low              │ Very High        │
│                        │             │                  │ (N deploys,      │
│                        │             │                  │  N databases,    │
│                        │             │                  │  N pipelines)    │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Data consistency       │ Strong      │ Strong           │ Eventual         │
│                        │ (1 DB)      │ (1 DB)           │ (N DBs)          │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Debugging              │ Easy        │ Easy             │ Hard             │
│                        │ (1 process) │ (1 process)      │ (distributed)    │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Network latency        │ None        │ None             │ Significant      │
│ between components     │ (in-memory) │ (in-memory)      │ (HTTP/gRPC)      │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Failure isolation      │ Poor        │ Moderate         │ Good             │
│                        │ (crash =    │ (module errors   │ (one service     │
│                        │  all down)  │  can be isolated)│  fails alone)    │
├────────────────────────┼─────────────┼──────────────────┼──────────────────┤
│ Migration path         │ ──────────► │ ──────────────►  │ (target state)   │
│                        │ Start here  │ Then here        │ Only if needed   │
└────────────────────────┴─────────────┴──────────────────┴──────────────────┘
```

---

## 4. The Cost of Microservices

### Operational Cost Checklist

```
Before adopting microservices, account for these costs:

INFRASTRUCTURE:
  □ Container orchestration (Kubernetes, ECS, etc.)
  □ Service discovery and load balancing
  □ Message broker (Kafka, RabbitMQ)
  □ API gateway
  □ Container registry
  □ Infrastructure as Code (Terraform, CloudFormation)
  □ Secret management (Vault, AWS Secrets Manager)
  □ Certificate management (TLS between services)

OBSERVABILITY:
  □ Centralized logging (ELK, Grafana Loki)
  □ Distributed tracing (Jaeger, Zipkin)
  □ Metrics collection (Prometheus, Grafana)
  □ Alerting system (PagerDuty, Opsgenie)
  □ Service health dashboards
  □ On-call rotation for N services

CI/CD:
  □ Separate pipeline per service
  □ Contract testing infrastructure
  □ Staging environment with all services
  □ Canary/blue-green deployment capability
  □ Rollback automation

DEVELOPMENT:
  □ Local development environment for N services
  □ Service templates/scaffolding
  □ Shared libraries versioning strategy
  □ API documentation per service (OpenAPI)
  □ Event schema registry

ESTIMATE:
  Small team (5-10 devs): These costs = 2-3 full-time engineers' worth of overhead
  Medium team (20-50 devs): These costs = 3-5 full-time engineers' worth of overhead
  Large team (50+ devs): These costs = 5-10% of engineering capacity
```

---

## 5. Migration Path: Monolith → Microservices

### The Strangler Fig Pattern

```
PHASE 1: Identify Bounded Contexts in the Monolith
  - Run Event Storming workshop
  - Map business capabilities to code modules
  - Identify the most independent module (fewest dependencies)

PHASE 2: Establish Module Boundaries in the Monolith
  - Enforce import restrictions between modules
  - Create explicit interfaces (ports) between modules
  - Separate database schemas per module (same DB, different schemas)

PHASE 3: Extract First Service
  - Pick the LEAST coupled module
  - Good first candidates:
    → Notification service (usually independent, low risk)
    → Search/indexing service (read-only, independent scaling need)
    → Analytics service (read-only, different tech stack need)
  - BAD first candidates:
    → Authentication service (everything depends on it)
    → Core business service (highest risk)

PHASE 4: Route Traffic
  - API Gateway routes new traffic to extracted service
  - Old monolith code for that feature is deactivated
  - Both run in parallel during transition period

PHASE 5: Iterate
  - Extract the next module
  - Each extraction takes 2-6 weeks depending on complexity
  - Monitor success metrics after each extraction
  - STOP extracting when the remaining monolith is manageable
```

### Migration Anti-Patterns

```
❌ Big Bang Rewrite
   "Let's rebuild the entire system as microservices from scratch"
   → This ALWAYS fails. Always. No exceptions.
   → Takes 2-3x longer than estimated
   → Business requirements change during the rewrite
   → You're maintaining TWO systems simultaneously

❌ Lift and Shift
   "Let's put each module in a Docker container — now it's microservices!"
   → If they still share a database, it's not microservices
   → If they still deploy together, it's not microservices
   → You've just added network latency for zero benefit

❌ Extracting Everything
   "Let's make EVERY module a separate service"
   → Not every module needs to be a service
   → Some modules are fine inside the monolith
   → Only extract what has a PROVEN need for independence
```

---

## 6. Success Metrics for Microservices

```
MEASURE THESE to verify microservices are helping, not hurting:

DEPLOYMENT:
  ✅ Deployment frequency per service (should INCREASE)
  ✅ Lead time from commit to production (should DECREASE)
  ✅ Deployment failure rate (should DECREASE)
  ✅ Mean time to recover (should DECREASE)

TEAM:
  ✅ Team autonomy: "Can team X deploy without coordinating with team Y?"
  ✅ Code ownership: "Is each service owned by exactly one team?"
  ✅ Developer satisfaction: "Do developers feel productive?"

SYSTEM:
  ✅ Service availability (should be > 99.9%)
  ✅ P99 latency (should be acceptable for user experience)
  ✅ Error rate (should be < 1%)
  ✅ Inter-service call count per request (should be < 5)

WARNING SIGNS:
  ⚠️ Deployment frequency DECREASED after adopting microservices
  ⚠️ Lead time INCREASED
  ⚠️ Teams still coordinate deployments ("deploy train")
  ⚠️ On-call burden INCREASED significantly
  ⚠️ More time spent on infrastructure than features
  → These mean microservices are HURTING, not helping
```

---

## 7. Industry Case Studies (Lessons, Not History)

```
WHAT WORKS:
  Amazon: Started monolith → Extracted services as teams grew → Two-Pizza teams
  Netflix: Monolith → Microservices driven by scaling needs (millions of streams)
  Spotify: Squad model → Each squad owns services → Independent deployment

  Common thread: ALL started with monoliths and extracted services GRADUALLY
  based on PROVEN needs, not theoretical benefits.

WHAT DOESN'T WORK:
  Startups: Build 15 microservices with 3 developers → Spend all time on ops
  Enterprises: Big-bang rewrite of legacy → 2 years, 10x budget, cancelled
  Copycats: "Netflix does it so we should too" → 5 developers, 20 services, chaos

  Common thread: Adopting microservices without the prerequisites (team size,
  DevOps maturity, domain understanding) leads to failure.
```

---

## 8. The Alternative: Modular Monolith

```
FOR MOST TEAMS, a modular monolith gives 80% of the benefits at 20% of the cost.

MODULAR MONOLITH GIVES YOU:
  ✅ Clear bounded contexts (just like microservices)
  ✅ Independent module development (different teams own different modules)
  ✅ Enforced boundaries (import restrictions, interface contracts)
  ✅ Simple deployment (one artifact)
  ✅ Strong consistency (one database, transactions)
  ✅ Easy debugging (one process, step-through debugging)
  ✅ Easy local development (run one application)
  ✅ Ready to extract to microservices when needed

MODULAR MONOLITH DOESN'T GIVE YOU:
  ❌ Independent deployment per module
  ❌ Independent scaling per module
  ❌ Technology diversity (all modules use same stack)
  ❌ Failure isolation (one module crash = entire app crash)

THE QUESTION IS: Do you NEED what the modular monolith doesn't give you?
If not, STAY with the modular monolith.
```

---

## 9. Decision Checklist

```
Before adopting microservices, answer YES to ALL:

□ Our team has > 20 developers who need to work independently
□ Different parts of our system have different scaling requirements
□ We need different parts to deploy on different schedules
□ We have automated CI/CD with < 15 min build times
□ We have container orchestration (Kubernetes, ECS, etc.)
□ We have centralized logging, tracing, and metrics
□ We have on-call rotation and incident response processes
□ We can clearly draw bounded context boundaries
□ We understand the domain well (not building MVP)
□ We have budget for 2-5 engineers focused on platform/infrastructure
□ Our deployment frequency will INCREASE (not decrease)
□ We have measured and confirmed that the monolith is the bottleneck

If ANY answer is NO → Start with or stay with a MODULAR MONOLITH.
```

---

## 10. Quick Reference: Architecture Selection

```
┌──────────────────────────────────────────────────────────────────┐
│                  CHOOSE YOUR ARCHITECTURE                        │
│                                                                  │
│  Team < 10, any project          → Simple Monolith               │
│  Team < 10, complex domain       → Modular Monolith              │
│  Team 10-30, growing             → Modular Monolith              │
│  Team 10-30, proven bottleneck   → Hybrid (monolith + 2-3 svcs)  │
│  Team > 30, mature DevOps        → Microservices                 │
│  Team > 30, immature DevOps      → Modular Monolith + DevOps     │
│                                    investment                    │
│  New product / MVP               → Monolith (ALWAYS)             │
│  Legacy modernization            → Strangler Fig (gradual)       │
│                                                                  │
│  DEFAULT: Modular Monolith → Extract only when proven necessary  │
└──────────────────────────────────────────────────────────────────┘
```
