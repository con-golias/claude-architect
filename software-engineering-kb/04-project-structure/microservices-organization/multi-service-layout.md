# Multi-Service Layout

> **AI Plugin Directive:** When organizing a multi-service / microservices project, ALWAYS use this guide. Apply proper repository strategies, service boundaries, shared code management, and inter-service communication patterns. This guide covers how to structure multiple services that work together as a system.

**Core Rule: Each service MUST be independently deployable, have its own database, and own its domain. Choose monorepo or polyrepo based on team structure. NEVER share databases between services. Define contracts between services via APIs (OpenAPI, gRPC, AsyncAPI).**

---

## 1. Repository Strategy Decision

```
How many services? / Team structure?
|
+-- 2-5 services, 1-2 teams
|   --> MONOREPO (recommended)
|       Shared tooling, atomic cross-service changes
|       Easy refactoring, single CI pipeline
|
+-- 5-20 services, 3-10 teams
|   --> MONOREPO with strong boundaries
|       Module boundaries enforced (CODEOWNERS, affected-only builds)
|       Turborepo/Nx for task orchestration
|       Consider domain-based monorepos (one per bounded context)
|
+-- 20+ services, 10+ teams
|   --> POLYREPO (one repo per service)
|       Independent team velocity, clear ownership
|       Shared libraries published as packages
|       Cross-service changes = PRs across repos
|
+-- Mixed (HYBRID) -- common at scale
    --> Monorepo per domain + shared libraries published
        Order domain: order-monorepo (order-svc, inventory-svc, shipping-svc)
        User domain: user-monorepo (user-svc, auth-svc, profile-svc)
        Shared: @platform/* packages published to registry
```

### 1.1 Repository Strategy Comparison

| Factor | Monorepo | Polyrepo | Hybrid |
|--------|----------|----------|--------|
| Cross-service changes | Single PR | Multiple PRs across repos | Single PR within domain |
| Code sharing | workspace:* (instant) | Publish + consume (versioned) | Mixed |
| CI/CD complexity | Single pipeline (affected builds) | Per-service pipelines | Domain pipelines |
| Team autonomy | Lower (shared tooling) | Higher (own choices) | Balanced |
| Onboarding | See everything | Focused on one service | See domain context |
| Refactoring | Atomic | Coordinated releases | Atomic within domain |
| Build times | Slower (without affected filter) | Fast (isolated) | Moderate |
| Code review | All changes visible | Isolated to service | Domain-scoped |
| Best for | Small-medium teams | Large organizations | Growth-stage |
| Examples | Google, Meta, Uber | Netflix, Amazon | Spotify (squads) |

---

## 2. Monorepo Layout (Multi-Service)

```
platform/
├── apps/                                  # Deployable services
│   ├── api-gateway/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── routes/
│   │   │   │   ├── user.routes.ts
│   │   │   │   ├── order.routes.ts
│   │   │   │   └── health.routes.ts
│   │   │   ├── middleware/
│   │   │   │   ├── rate-limit.ts
│   │   │   │   ├── cors.ts
│   │   │   │   └── auth.ts
│   │   │   └── config.ts
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── main.ts                    # Entry point
│   │   │   ├── app.ts                     # Express/Fastify app setup
│   │   │   ├── config/
│   │   │   │   ├── index.ts
│   │   │   │   └── schema.ts             # Zod config validation
│   │   │   ├── controllers/
│   │   │   │   ├── user.controller.ts
│   │   │   │   └── health.controller.ts
│   │   │   ├── services/
│   │   │   │   └── user.service.ts
│   │   │   ├── repositories/
│   │   │   │   └── user.repository.ts
│   │   │   ├── events/
│   │   │   │   ├── publishers/
│   │   │   │   │   └── user-created.publisher.ts
│   │   │   │   └── consumers/
│   │   │   │       └── order-placed.consumer.ts
│   │   │   ├── clients/
│   │   │   │   └── notification.client.ts
│   │   │   ├── models/
│   │   │   │   └── user.model.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   └── user-response.dto.ts
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.ts
│   │   │       └── validation.middleware.ts
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── user.service.test.ts
│   │   │   │   └── user.repository.test.ts
│   │   │   ├── integration/
│   │   │   │   ├── user.controller.test.ts
│   │   │   │   └── user-events.test.ts
│   │   │   └── contract/
│   │   │       └── user-api.pact.test.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma              # User service database schema
│   │   │   └── migrations/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── order-service/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── events/
│   │   │   ├── clients/
│   │   │   │   ├── user.client.ts         # Calls user-service
│   │   │   │   └── payment.client.ts      # Calls payment-service
│   │   │   └── models/
│   │   ├── tests/
│   │   ├── prisma/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── payment-service/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── notification-service/
│       ├── src/
│       ├── tests/
│       ├── Dockerfile
│       └── package.json
│
├── packages/                              # Shared internal packages
│   ├── @platform/logger/                  # Structured logging
│   ├── @platform/auth/                    # Authentication middleware
│   ├── @platform/events/                  # Event schemas + bus abstraction
│   ├── @platform/errors/                  # Error handling
│   ├── @platform/health/                  # Health check endpoints
│   ├── @platform/http-client/             # HTTP client with retry
│   ├── @platform/config/                  # Configuration loading
│   ├── @platform/tracing/                 # OpenTelemetry tracing
│   ├── @platform/metrics/                 # Prometheus metrics
│   ├── @platform/testing/                 # Test utilities + mocks
│   └── config/                            # Shared configurations
│       ├── eslint-config/                 # Shared ESLint config
│       ├── tsconfig/                      # Shared TypeScript config
│       └── docker/                        # Shared Dockerfile base
│
├── contracts/                             # API contracts (source of truth)
│   ├── openapi/
│   │   ├── user-service/
│   │   │   └── v1/openapi.yaml
│   │   ├── order-service/
│   │   │   └── v1/openapi.yaml
│   │   └── payment-service/
│   │       └── v1/openapi.yaml
│   ├── proto/
│   │   ├── buf.yaml
│   │   ├── buf.gen.yaml
│   │   ├── user/v1/user.proto
│   │   └── order/v1/order.proto
│   └── asyncapi/
│       ├── user-events.yaml
│       ├── order-events.yaml
│       └── payment-events.yaml
│
├── infrastructure/                        # Deployment configs
│   ├── k8s/
│   │   ├── base/
│   │   │   ├── namespace.yaml
│   │   │   └── network-policy.yaml
│   │   ├── services/
│   │   │   ├── user-service/
│   │   │   │   ├── kustomization.yaml
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   ├── hpa.yaml
│   │   │   │   └── ingress.yaml
│   │   │   ├── order-service/
│   │   │   └── payment-service/
│   │   └── overlays/
│   │       ├── dev/
│   │       │   └── kustomization.yaml
│   │       ├── staging/
│   │       │   └── kustomization.yaml
│   │       └── production/
│   │           └── kustomization.yaml
│   ├── terraform/
│   │   ├── modules/
│   │   └── environments/
│   ├── helm/
│   │   └── platform/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       └── templates/
│   └── docker-compose.yml                 # Local development (ALL services)
│
├── tools/                                 # Development tools
│   ├── scripts/
│   │   ├── generate-client.sh             # Generate API clients from contracts
│   │   ├── seed-data.sh                   # Seed databases with test data
│   │   ├── run-migrations.sh              # Run all DB migrations
│   │   └── health-check.sh               # Check all services health
│   └── generators/
│       └── new-service/                   # Service scaffold template
│           ├── copier.yml                 # Copier template config
│           └── template/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Affected-only CI
│       ├── deploy-staging.yml
│       ├── deploy-production.yml
│       └── contracts-check.yml
│
├── package.json                           # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json                             # Turborepo task config
├── .npmrc
├── CODEOWNERS                             # Per-service ownership
└── README.md
```

---

## 3. Polyrepo Layout (Multi-Service)

```
Organization on GitHub:
  github.com/myorg/

  Service repositories (one per service):
  ├── user-service
  ├── order-service
  ├── payment-service
  ├── notification-service
  ├── api-gateway

  Shared library repositories:
  ├── platform-logger              # Published as @myorg/logger
  ├── platform-auth                # Published as @myorg/auth
  ├── platform-events              # Published as @myorg/events
  ├── platform-errors              # Published as @myorg/errors
  ├── platform-testing             # Published as @myorg/testing

  Contract & infrastructure repositories:
  ├── api-contracts                # OpenAPI + Proto + AsyncAPI definitions
  ├── infrastructure               # Terraform + K8s manifests
  └── platform-docs                # System-wide documentation


Each service repo structure:
  user-service/
  ├── src/
  │   ├── main.ts
  │   ├── controllers/
  │   ├── services/
  │   ├── repositories/
  │   ├── events/
  │   ├── clients/
  │   ├── models/
  │   ├── dto/
  │   ├── middleware/
  │   └── config/
  ├── tests/
  │   ├── unit/
  │   ├── integration/
  │   └── contract/
  ├── prisma/
  │   ├── schema.prisma
  │   └── migrations/
  ├── k8s/
  │   ├── base/
  │   │   ├── kustomization.yaml
  │   │   ├── deployment.yaml
  │   │   ├── service.yaml
  │   │   └── hpa.yaml
  │   └── overlays/
  │       ├── dev/
  │       ├── staging/
  │       └── production/
  ├── .github/
  │   └── workflows/
  │       ├── ci.yml
  │       ├── deploy-staging.yml
  │       └── deploy-production.yml
  ├── Dockerfile
  ├── docker-compose.yml           # Local dev (this service + deps)
  ├── package.json
  ├── tsconfig.json
  ├── vitest.config.ts
  ├── .env.example
  ├── .gitignore
  ├── .dockerignore
  └── README.md
```

---

## 4. Service Boundary Design

```
DOMAIN-DRIVEN DESIGN BOUNDARIES:

Each service owns a bounded context:

+-------------------+    +-------------------+    +-------------------+
| User Context      |    | Order Context     |    | Payment Context   |
|                   |    |                   |    |                   |
| - Registration    |    | - Cart            |    | - Charge          |
| - Authentication  |    | - Checkout        |    | - Refund          |
| - Profile         |    | - Order lifecycle |    | - Subscription    |
| - Permissions     |    | - Fulfillment     |    | - Invoice         |
|                   |    |                   |    |                   |
| DB: user_db       |    | DB: order_db      |    | DB: payment_db    |
| Events: user.*    |    | Events: order.*   |    | Events: payment.* |
+-------------------+    +-------------------+    +-------------------+

BOUNDARY RULES:
  1. Each service owns its data (database per service)
  2. No direct database queries across boundaries
  3. Communication via APIs or events ONLY
  4. Each service can be deployed independently
  5. Services can use different languages/frameworks (polyglot)
  6. Shared data = shared via events (eventual consistency)

DETECTING WRONG BOUNDARIES:
  Symptom: Two services always deploy together
  Fix: They should be one service

  Symptom: Service A reads service B's database
  Fix: Service B exposes an API

  Symptom: Circular dependencies (A calls B, B calls A)
  Fix: Extract shared logic to events or third service

  Symptom: "Thin" service that just proxies to another
  Fix: Merge with the service it proxies to
```

---

## 5. Inter-Service Communication

```
COMMUNICATION PATTERNS:

1. Synchronous (Request-Response):
  +-----------+   HTTP/gRPC   +-------------+
  | Order     | ------------> | User        |
  | Service   | <------------ | Service     |
  +-----------+   Response    +-------------+

  When: Need immediate response (authentication, price lookup)
  Risk: Coupling, cascading failures, increased latency
  Mitigation: Circuit breaker, timeout, retry, fallback cache
  Protocol: gRPC (internal), REST (external/simple)

2. Asynchronous (Events):
  +-----------+   Message Bus   +----------------+
  | User      | --[UserCreated]--> | Notification  |
  | Service   |                    | Service       |
  +-----------+                    +----------------+
                                   +----------------+
                               --> | Analytics      |
                                   | Service        |
                                   +----------------+

  When: Can tolerate eventual consistency
  Benefit: Loose coupling, resilient, scalable
  Tools: RabbitMQ, Kafka, AWS SQS/SNS, Google Pub/Sub
  Patterns: Pub/Sub, Event Sourcing, CQRS

3. Saga Pattern (Distributed Transactions):
  Order Service        Payment Service       Inventory Service
  1. Create order  -->
  2.                   3. Charge payment -->
  4.                                        5. Reserve stock
  6.                   7. If charge fails, compensate:
  8. Cancel order  <-- 9. Refund           10. Release stock

  When: Multi-service transaction (order = pay + reserve + ship)
  Types: Choreography (events) or Orchestration (saga coordinator)
  Recommendation: Orchestration for complex sagas (easier to debug)

DECISION MATRIX:
  Need immediate response?          --> Synchronous (gRPC preferred)
  Can be eventually consistent?     --> Asynchronous (events)
  Multi-service transaction?        --> Saga (orchestrated or choreographed)
  Need both?                        --> CQRS (commands sync, queries async)
  High throughput, ordered events?  --> Kafka
  Simple pub/sub, at-least-once?    --> RabbitMQ or SQS
```

---

## 6. Service Mesh Configuration

```
SERVICE MESH (for production Kubernetes):

What: Infrastructure layer for service-to-service communication.
Handles: mTLS, load balancing, circuit breaking, observability, retries.

OPTIONS:
  Istio        -- Most feature-rich, complex to operate
  Linkerd      -- Simplest, lightweight, Rust-based (RECOMMENDED)
  Cilium       -- eBPF-based, high performance, also does networking

WHEN TO USE SERVICE MESH:
  10+ services in Kubernetes
  Need mTLS (zero-trust networking)
  Need traffic management (canary, blue-green)
  Need service-level observability

WHEN NOT TO USE:
  < 10 services (overhead not worth it)
  Not on Kubernetes
  Simple HTTP with manual retry/circuit breaker is sufficient

LINKERD SETUP:
  # Install Linkerd
  linkerd install --crds | kubectl apply -f -
  linkerd install | kubectl apply -f -
  linkerd viz install | kubectl apply -f -

  # Mesh a namespace
  kubectl annotate namespace my-app linkerd.io/inject=enabled

  # All pods in namespace get Linkerd sidecar proxy
  # mTLS automatic, metrics automatic, retries configurable

ISTIO VIRTUAL SERVICE (traffic splitting):
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: user-service
spec:
  hosts:
    - user-service
  http:
    - route:
        - destination:
            host: user-service
            subset: v1
          weight: 90
        - destination:
            host: user-service
            subset: v2
          weight: 10       # 10% canary traffic
      retries:
        attempts: 3
        retryOn: 5xx
      timeout: 5s
```

---

## 7. Local Development (docker-compose)

```yaml
# docker-compose.yml -- Run ALL services locally

services:
  # ======= APPLICATION SERVICES =======
  api-gateway:
    build:
      context: .
      dockerfile: apps/api-gateway/Dockerfile
      target: development
    ports: ["3000:3000"]
    depends_on:
      user-service:
        condition: service_healthy
      order-service:
        condition: service_healthy
    environment:
      USER_SERVICE_URL: http://user-service:3001
      ORDER_SERVICE_URL: http://order-service:3002
      PAYMENT_SERVICE_URL: http://payment-service:3003
    volumes:
      - ./apps/api-gateway/src:/app/src

  user-service:
    build:
      context: .
      dockerfile: apps/user-service/Dockerfile
      target: development
    ports: ["3001:3001"]
    depends_on:
      user-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@user-db:5432/users
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      JWT_SECRET: dev-secret-key-not-for-production
      LOG_LEVEL: debug
    volumes:
      - ./apps/user-service/src:/app/src
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  order-service:
    build:
      context: .
      dockerfile: apps/order-service/Dockerfile
      target: development
    ports: ["3002:3002"]
    depends_on:
      order-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@order-db:5432/orders
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      USER_SERVICE_URL: http://user-service:3001
    volumes:
      - ./apps/order-service/src:/app/src
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  payment-service:
    build:
      context: .
      dockerfile: apps/payment-service/Dockerfile
      target: development
    ports: ["3003:3003"]
    depends_on:
      payment-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@payment-db:5432/payments
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      STRIPE_API_KEY: sk_test_fake_key
    volumes:
      - ./apps/payment-service/src:/app/src

  notification-service:
    build:
      context: .
      dockerfile: apps/notification-service/Dockerfile
      target: development
    ports: ["3004:3004"]
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      REDIS_URL: redis://redis:6379

  # ======= DATABASES (per service) =======
  user-db:
    image: postgres:16-alpine
    ports: ["5433:5432"]
    environment:
      POSTGRES_DB: users
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - user-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  order-db:
    image: postgres:16-alpine
    ports: ["5434:5432"]
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - order-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  payment-db:
    image: postgres:16-alpine
    ports: ["5435:5432"]
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - payment-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ======= INFRASTRUCTURE =======
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    ports:
      - "5672:5672"      # AMQP
      - "15672:15672"    # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ======= OBSERVABILITY (optional for local) =======
  jaeger:
    image: jaegertracing/all-in-one:1.54
    ports:
      - "16686:16686"   # Jaeger UI
      - "4318:4318"     # OTLP HTTP
    environment:
      COLLECTOR_OTLP_ENABLED: true

volumes:
  user-db-data:
  order-db-data:
  payment-db-data:
  rabbitmq-data:
  redis-data:
```

---

## 8. Kubernetes Namespace Organization

```
NAMESPACE STRATEGY:

Option A: Namespace per environment (SIMPLE)
  dev/
    user-service, order-service, payment-service
  staging/
    user-service, order-service, payment-service
  production/
    user-service, order-service, payment-service

Option B: Namespace per service (ISOLATION)
  user-service-dev, user-service-staging, user-service-prod
  order-service-dev, order-service-staging, order-service-prod

Option C: Namespace per domain (RECOMMENDED)
  user-domain/
    user-service, auth-service, profile-service
  order-domain/
    order-service, inventory-service, shipping-service
  infra/
    rabbitmq, redis, monitoring

RECOMMENDATION: Namespace per environment for < 20 services.
Namespace per domain for 20+ services.

NETWORK POLICIES (zero-trust):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: user-service-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: user-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
        - podSelector:
            matchLabels:
              app: order-service
      ports:
        - port: 3001
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: user-db
      ports:
        - port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: rabbitmq
      ports:
        - port: 5672
```

---

## 9. Service Discovery

```
SERVICE DISCOVERY PATTERNS:

1. Kubernetes DNS (RECOMMENDED for K8s):
  http://user-service.production.svc.cluster.local:3001
  Simplified: http://user-service:3001 (same namespace)
  No extra infrastructure needed.

2. Environment Variables:
  USER_SERVICE_URL=http://user-service:3001
  Simple, works everywhere, configured per environment.

3. Service Mesh (Linkerd/Istio):
  Automatic service discovery via sidecar proxy.
  mTLS, load balancing, retries built-in.

4. Consul (HashiCorp):
  Service registry + health checking + config.
  Use when: multi-datacenter, not on K8s, need KV store.

5. AWS Cloud Map / GCP Service Directory:
  Cloud-native service discovery.
  Integrates with ECS/EKS/Fargate.

RECOMMENDATION:
  Kubernetes         --> K8s DNS + env vars (simplest)
  Kubernetes at scale --> Service mesh (Linkerd)
  Not on Kubernetes  --> Consul or cloud-native
  docker-compose     --> Docker DNS (service name = hostname)
```

---

## 10. Monorepo CI/CD Configuration

```json
// turbo.json (Turborepo)
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "tests/**"]
    },
    "lint": {
      "inputs": ["src/**", "*.config.*"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "deploy": {
      "dependsOn": ["build", "test", "lint"],
      "cache": false
    },
    "docker:build": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

```yaml
# .github/workflows/ci.yml (monorepo with affected-only builds)
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            user-service:
              - 'apps/user-service/**'
              - 'packages/**'
            order-service:
              - 'apps/order-service/**'
              - 'packages/**'
            payment-service:
              - 'apps/payment-service/**'
              - 'packages/**'
            contracts:
              - 'contracts/**'

  test:
    needs: detect-changes
    if: needs.detect-changes.outputs.services != '[]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build affected
        run: pnpm turbo build --filter='...[origin/main]'

      - name: Test affected
        run: pnpm turbo test --filter='...[origin/main]'

      - name: Lint affected
        run: pnpm turbo lint --filter='...[origin/main]'
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Shared database | Changes in one service break another | Tight coupling, migration conflicts | Database per service, communicate via APIs/events |
| No API contracts | Breaking changes discovered at runtime | Production failures, finger-pointing | OpenAPI/gRPC specs in contracts/ directory |
| Distributed monolith | Services tightly coupled, must deploy together | Worst of both worlds: complexity of microservices + coupling of monolith | Async events, loose coupling, proper boundaries |
| Too many services too early | Operational overhead > development benefit | Slow development, complex debugging | Start with monolith, extract services when needed |
| No service template | Each service structured differently | Inconsistent quality, slow onboarding | Copier/cookiecutter template for new services |
| Direct DB queries across services | Service reads another service's database | Invisible coupling, schema lock-in | API calls or events only |
| Synchronous chains | A -> B -> C -> D cascade failures | One slow service brings down everything | Async events, circuit breakers, caching |
| No local dev setup | "Works in staging" debugging approach | Slow iteration, expensive debugging | docker-compose for full local stack |
| No health checks | Services fail silently, bad traffic routing | Users see errors, K8s can't recover | /health and /ready endpoints on every service |
| No distributed tracing | Cannot trace requests across services | Impossible to debug cross-service issues | OpenTelemetry + Jaeger/Zipkin |
| N+1 service calls | Loop calling another service per item | Latency multiplication, resource waste | Batch APIs, caching, or denormalize |

---

## 12. Enforcement Checklist

- [ ] Each service independently deployable -- own Dockerfile, CI, database
- [ ] Database per service -- NO shared databases
- [ ] API contracts defined -- OpenAPI, gRPC protos, or AsyncAPI
- [ ] Internal structure consistent -- same pattern across all services
- [ ] Events for cross-service communication -- prefer async over sync
- [ ] Service clients generated from contracts -- typed, never hand-written
- [ ] docker-compose for local dev -- all services + infrastructure
- [ ] Service template / generator -- new services start from scaffold
- [ ] Health endpoints -- `/health` and `/ready` on every service
- [ ] Independent CI/CD -- each service has own pipeline (or affected-only)
- [ ] Circuit breakers -- on all synchronous inter-service calls
- [ ] Distributed tracing -- OpenTelemetry with correlation IDs
- [ ] CODEOWNERS -- each service/package has designated owners
- [ ] Namespace strategy -- per environment or per domain in K8s
- [ ] Network policies -- restrict which services can communicate
- [ ] Service discovery -- K8s DNS + env vars (simplest)
- [ ] Graceful shutdown -- handle SIGTERM in every service
- [ ] Structured logging -- JSON logs with service name + correlation ID
