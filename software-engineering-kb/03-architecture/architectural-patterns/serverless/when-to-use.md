# Serverless: When to Use — Complete Specification

> **AI Plugin Directive:** Serverless is optimal for event-driven, variable-traffic workloads where operational simplicity outweighs cold start latency. It is NOT suitable for all applications. Use serverless for APIs with unpredictable traffic, event processing, scheduled tasks, and data pipelines. Do NOT use serverless for long-running processes, latency-critical applications, or workloads that need persistent connections.

---

## 1. When Serverless IS the Right Choice

```
✅ VARIABLE / UNPREDICTABLE TRAFFIC
   - Traffic spikes 10x during sales events
   - Weekend traffic is 1% of weekday traffic
   - Startup with unknown growth trajectory
   → Serverless scales automatically and costs $0 when idle

✅ EVENT-DRIVEN WORKLOADS
   - Process file uploads (resize images, scan viruses)
   - React to database changes (DynamoDB Streams)
   - Handle webhook callbacks (Stripe, GitHub, Shopify)
   - Process queue messages (order fulfillment, notifications)
   → These are inherently event-driven — serverless is natural fit

✅ SCHEDULED / BATCH JOBS
   - Daily reports, hourly data sync, weekly cleanup
   - Don't want to maintain a cron server for 5-minute daily jobs
   → EventBridge Scheduler + Lambda is simpler than maintaining a server

✅ API BACKENDS WITH MODERATE LATENCY TOLERANCE
   - Internal tools, admin panels, CRUD APIs
   - B2B APIs where 200-500ms latency is acceptable
   - APIs with < 100 req/sec sustained traffic
   → Simple deployment, zero server management

✅ PROTOTYPES AND MVPs
   - Need to ship fast without worrying about infrastructure
   - Traffic is low and unpredictable
   - Cost must be near zero until product takes off
   → Pay-per-use: $0 for no traffic, scales if successful

✅ GLUE AND INTEGRATION CODE
   - Connect SaaS products (Stripe → Slack notification)
   - ETL: Extract from API → Transform → Load to database
   - Webhook processors
   → Small functions that run occasionally
```

---

## 2. When Serverless is NOT the Right Choice

```
❌ CONSISTENT LOW-LATENCY REQUIREMENTS (< 50ms)
   - Real-time gaming, high-frequency trading
   - Cold starts make consistent sub-50ms impossible
   → Use containers (ECS/Kubernetes) or dedicated servers

❌ LONG-RUNNING PROCESSES
   - Video encoding (15+ minutes)
   - Large data processing jobs (hours)
   - WebSocket servers
   → Lambda max is 15 minutes. Use ECS/Fargate or EC2

❌ HIGH SUSTAINED TRAFFIC
   - 10,000+ req/sec sustained (not burst)
   - Cost at high sustained traffic is HIGHER than containers
   → At this scale, reserved containers are cheaper

❌ STATEFUL APPLICATIONS
   - WebSocket connections that last minutes/hours
   - In-memory caching between requests
   - Session-based applications
   → Lambda is stateless. Use containers for stateful workloads

❌ GPU / SPECIALIZED HARDWARE
   - ML model training, video rendering
   - Functions don't have GPU access
   → Use SageMaker, EC2 with GPU, or GKE with GPU nodes

❌ COMPLEX MONOLITHIC APPLICATIONS
   - Large NestJS/Django/Spring Boot applications
   - Not designed for function-per-route decomposition
   → Run as container on ECS/Cloud Run, not Lambda

❌ DATABASE-HEAVY WORKLOADS WITH SQL
   - Hundreds of concurrent Lambda instances → hundreds of DB connections
   - Even with RDS Proxy, connection management is complex
   → Better on containers with connection pooling
```

---

## 3. Cost Comparison

```
SERVERLESS COST MODEL:
  Pay per invocation + per GB-second of execution
  $0 when idle

  Example: 1 million requests/month, 200ms avg, 512MB
    Invocations: 1,000,000 × $0.20/million = $0.20
    Compute: 1,000,000 × 0.2s × 0.5GB × $0.0000166667 = $1.67
    API Gateway: 1,000,000 × $1.00/million = $1.00
    TOTAL: ~$3/month

CONTAINER COST MODEL (ECS Fargate):
  Pay for allocated CPU + memory per hour
  Running 24/7

  Example: 1 vCPU, 2GB RAM, running 24/7
    Compute: 1 × $0.04048/hr × 730 hrs = $29.55
    Memory: 2 × $0.004445/hr × 730 hrs = $6.49
    Load Balancer: ~$16/month
    TOTAL: ~$52/month

BREAKEVEN POINT:
  Serverless is cheaper when:
    - < 3 million requests/month (for typical API workloads)
    - Traffic is highly variable (spiky, idle periods)
    - Functions are short-lived (< 1 second)

  Containers are cheaper when:
    - > 5 million requests/month sustained
    - Traffic is consistent (no idle periods)
    - Long-running processes
```

---

## 4. Decision Tree

```
What type of workload?
├── Event processing (queue, webhook, file trigger)
│   └── SERVERLESS (Lambda + SQS/SNS/EventBridge)
├── Scheduled job (cron, periodic task)
│   └── SERVERLESS (Lambda + EventBridge Scheduler)
├── REST/GraphQL API
│   ├── Variable traffic, low-medium volume?
│   │   └── SERVERLESS (API Gateway + Lambda)
│   ├── High sustained traffic (> 5K req/sec)?
│   │   └── CONTAINERS (ECS/Cloud Run/Kubernetes)
│   └── Latency-critical (< 50ms p99)?
│       └── CONTAINERS (with auto-scaling)
├── WebSocket / real-time
│   └── CONTAINERS (or AppSync for GraphQL subscriptions)
├── Long-running process (> 15 min)
│   └── CONTAINERS (ECS Fargate / Cloud Run)
├── Monolithic web app (Rails, Django, Spring)
│   └── CONTAINERS (single container deployment)
└── ML model serving
    └── CONTAINERS with GPU (SageMaker / GKE)
```

---

## 5. Serverless vs Containers Decision Matrix

```
┌───────────────────────┬──────────────────┬──────────────────┐
│ Factor                │ Serverless       │ Containers       │
├───────────────────────┼──────────────────┼──────────────────┤
│ Operational overhead  │ Near zero        │ Medium-High      │
│ Cold start latency    │ 100ms - 5s       │ None (running)   │
│ Max execution time    │ 15 min (Lambda)  │ Unlimited        │
│ Scaling speed         │ Instant          │ Seconds-Minutes  │
│ Scale to zero         │ Yes (free)       │ Possible (KEDA)  │
│ Cost at low traffic   │ Near zero        │ Fixed minimum    │
│ Cost at high traffic  │ Can be expensive │ More predictable │
│ Stateful workloads    │ Not supported    │ Supported        │
│ Local development     │ Challenging      │ Same as prod     │
│ Vendor lock-in        │ High (Lambda)    │ Low (Docker)     │
│ Debugging             │ Harder (remote)  │ Easier (local)   │
│ Team expertise needed │ AWS services     │ Docker/K8s       │
│ Best for              │ Event-driven,    │ Long-running,    │
│                       │ APIs, glue code  │ high-traffic,    │
│                       │                  │ complex apps     │
└───────────────────────┴──────────────────┴──────────────────┘
```

---

## 6. Hybrid Approach (Recommended)

```
MOST real-world architectures combine serverless and containers:

SERVERLESS:
  - API endpoints with variable traffic
  - Event processors (queue consumers)
  - Scheduled jobs and cron tasks
  - File processing triggers
  - Webhook handlers

CONTAINERS:
  - Core application server (if monolithic)
  - WebSocket servers
  - Long-running background workers
  - ML model serving
  - Database migrations

EXAMPLE:
  ┌──────────────────────────────────────────────────┐
  │ API Gateway → Lambda (REST API)                  │  ← Serverless
  │ SQS → Lambda (event processing)                  │  ← Serverless
  │ EventBridge → Lambda (scheduled tasks)            │  ← Serverless
  │ ECS Fargate → WebSocket server                    │  ← Container
  │ ECS Fargate → ML prediction service               │  ← Container
  │ RDS → PostgreSQL (managed database)               │  ← Managed
  │ DynamoDB (serverless tables)                      │  ← Serverless
  │ S3 + CloudFront (static assets)                   │  ← Serverless
  └──────────────────────────────────────────────────┘
```

---

## 7. Enforcement Checklist

- [ ] **Workload type matches** — event-driven and variable traffic → serverless
- [ ] **Latency requirements checked** — cold starts acceptable for this use case
- [ ] **Execution time fits** — workload completes within function timeout limit
- [ ] **Cost calculated** — serverless cheaper than containers for this traffic pattern
- [ ] **Statelessness confirmed** — workload doesn't need persistent connections or in-memory state
- [ ] **Vendor lock-in accepted** — team understands and accepts cloud provider dependency
- [ ] **Local development strategy** — tooling for local testing (SAM local, serverless-offline)
- [ ] **Hybrid considered** — use serverless where it fits, containers where it doesn't
- [ ] **No forced fit** — don't force a monolithic app into Lambda functions
