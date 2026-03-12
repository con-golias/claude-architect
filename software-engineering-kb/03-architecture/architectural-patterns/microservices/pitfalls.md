# Microservices: Pitfalls — Complete Specification

> **AI Plugin Directive:** Microservices introduce SIGNIFICANT complexity. Most failures come from underestimating operational overhead, drawing wrong boundaries, and treating microservices as the default architecture. EVERY pitfall listed here has caused real production outages at companies that adopted microservices prematurely or incorrectly. Learn from their mistakes — do not repeat them.

---

## 1. Pitfall: Distributed Monolith

### What It Is

**A distributed monolith is a system that has all the disadvantages of microservices (network latency, operational complexity, distributed debugging) with NONE of the benefits (independent deployment, independent scaling, team autonomy).**

### How to Detect

```
SYMPTOMS:
  □ Services must be deployed together ("deploy train")
  □ Changing one service requires changes in 3+ other services
  □ Shared database between services
  □ Shared library that all services depend on (and update together)
  □ Cannot run or test one service without running all others
  □ Service A directly calls Service B's internal methods/private APIs
  □ Circular dependencies between services
  □ One team owns multiple services that always change together
```

### How to Fix

```typescript
// FIX 1: Replace shared database with events

// ❌ BEFORE: Both services read/write the same customer table
// OrderService: SELECT * FROM customers WHERE id = ?
// BillingService: UPDATE customers SET credit_limit = ?

// ✅ AFTER: Each service has its own customer data
// IdentityService: owns customer table, publishes CustomerUpdated events
// OrderService: maintains local customer_cache from events
// BillingService: maintains local billing_accounts from events

// FIX 2: Replace shared library with contracts
// ❌ BEFORE: @company/shared-models v3.2.1 used by all services
// ✅ AFTER: Each service defines its own DTOs, contract tests verify compatibility

// FIX 3: Replace sync chains with events
// ❌ BEFORE: Gateway → Order → Inventory → Pricing → Tax → Shipping
// ✅ AFTER: Gateway → Order (publishes OrderPlaced)
//          Inventory, Pricing, Tax, Shipping all subscribe independently
```

---

## 2. Pitfall: Premature Decomposition

### What It Is

**Breaking a system into microservices BEFORE understanding the domain. Wrong boundaries are 10x harder to fix than wrong code.**

### The Rule

```
NEVER start with microservices for a new project.
ALWAYS start with a well-structured modular monolith.
Extract microservices ONLY when you have proven need.

Timeline:
  Month 0-6:   Modular monolith with clear bounded contexts
  Month 6-12:  Identify modules with different scaling/deployment needs
  Month 12+:   Extract those specific modules into services

  NOT: Day 1: "Let's build 15 microservices!"
```

### Signs of Premature Decomposition

```
□ You are building a new product with unclear requirements
□ Your team has fewer than 10 developers
□ You don't have automated CI/CD, monitoring, or container orchestration
□ You cannot clearly describe what each service does in one sentence
□ Your services have fewer than 3 endpoints each
□ You are spending more time on infrastructure than business logic
□ Service boundaries have changed 3+ times in the first year
```

---

## 3. Pitfall: No Observability

### What It Is

**Running microservices without proper logging, tracing, and metrics is like driving at night with no headlights. You WILL crash, and you won't know where or why.**

### What You MUST Have Before Going to Production

```
MINIMUM OBSERVABILITY STACK:

1. Structured Logging (ALL services)
   Tool: ELK Stack (Elasticsearch + Logstash + Kibana) or Grafana Loki
   Rule: JSON logs with traceId, service name, level, timestamp

2. Distributed Tracing (ALL services)
   Tool: Jaeger, Zipkin, or AWS X-Ray
   Rule: Trace context propagated in EVERY inter-service call

3. Metrics (ALL services)
   Tool: Prometheus + Grafana
   Rule: RED metrics (Rate, Error, Duration) for every endpoint

4. Alerting (ALL services)
   Tool: Alertmanager, PagerDuty, or Opsgenie
   Rule: Alert on error rate > 1%, latency p99 > 2s, service health

5. Centralized Dashboard
   Tool: Grafana
   Rule: One dashboard per service + one system-wide dashboard

OBSERVATION: If you don't have all 5, you are NOT ready for microservices.
```

### Correlation ID Implementation

```typescript
// EVERY request that enters the system gets a correlation ID.
// This ID is passed through ALL service calls and logged in EVERY log entry.

// API Gateway: Generate or extract correlation ID
function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || uuid();
  const store = { correlationId, service: 'api-gateway' };

  // Store in async context for automatic propagation
  asyncLocalStorage.run(store, () => {
    res.setHeader('x-correlation-id', correlationId);
    next();
  });
}

// HTTP client: Propagate correlation ID
class ServiceClient {
  async get<T>(url: string): Promise<T> {
    const store = asyncLocalStorage.getStore();
    const response = await fetch(url, {
      headers: {
        'x-correlation-id': store?.correlationId ?? uuid(),
        'x-caller-service': store?.service ?? 'unknown',
      },
    });
    return response.json();
  }
}

// Kafka producer: Include correlation ID in message headers
class EventPublisher {
  async publish(topic: string, event: DomainEvent): Promise<void> {
    const store = asyncLocalStorage.getStore();
    await this.kafka.send({
      topic,
      messages: [{
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          'correlation-id': store?.correlationId ?? uuid(),
          'source-service': store?.service ?? 'unknown',
        },
      }],
    });
  }
}

// Logger: Automatically include correlation ID
class Logger {
  info(message: string, data?: Record<string, unknown>) {
    const store = asyncLocalStorage.getStore();
    console.log(JSON.stringify({
      level: 'info',
      message,
      correlationId: store?.correlationId,
      service: store?.service,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  }
}
```

---

## 4. Pitfall: Synchronous Call Chains

### What It Is

**Service A calls B, B calls C, C calls D. Total latency = A + B + C + D. If ANY service fails, the entire chain fails. This is the most common cause of cascading failures.**

### The Math of Failure

```
If each service has 99.5% availability:
  1 service:  99.5%
  2 services: 99.5% × 99.5% = 99.0%
  3 services: 99.5%³ = 98.5%
  5 services: 99.5%⁵ = 97.5%
  10 services: 99.5%¹⁰ = 95.1%

A chain of 10 services at 99.5% each = only 95.1% availability
That's 18+ HOURS of downtime per year from the chain alone.
```

### How to Fix

```
RULE: Maximum 2 synchronous hops for any user request.

❌ FORBIDDEN CHAIN:
  API Gateway → OrderService → InventoryService → PricingService → TaxService
  (4 sync hops, cascading failure risk)

✅ FIX 1: Parallel calls instead of chain
  API Gateway → OrderService
                  ├── InventoryService (parallel)
                  ├── PricingService   (parallel)
                  └── TaxService       (parallel)
  (1 hop, services called in parallel)

✅ FIX 2: Event-driven with local cache
  OrderService:
    - Reads inventory from local cache (updated by InventoryReserved events)
    - Reads pricing from local cache (updated by PriceChanged events)
    - Calculates tax locally (tax rules cached from TaxService events)
    - 0 sync hops for the common path

✅ FIX 3: Aggregate service (BFF)
  API Gateway → OrderBFF (aggregates data from 3 services in parallel)
                  → OrderService, InventoryService, PricingService
  (2 hops max: gateway → BFF → service)
```

---

## 5. Pitfall: Missing Circuit Breakers

### What It Is

**When one service fails, it takes down all services that call it. Without circuit breakers, a single failing service causes a cascading failure across the entire system.**

### Complete Circuit Breaker Implementation

```typescript
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)

enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation, requests pass through
  OPEN = 'OPEN',           // Failing, requests immediately rejected
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly options: {
      failureThreshold: number;     // Open after N failures (e.g., 5)
      resetTimeoutMs: number;       // Try half-open after N ms (e.g., 30000)
      halfOpenMaxAttempts: number;  // Close after N successes in half-open (e.g., 3)
    },
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        // Circuit is open — use fallback or throw
        if (fallback) return fallback();
        throw new CircuitOpenError('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();

      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.options.halfOpenMaxAttempts) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
        }
      } else {
        this.failureCount = 0; // Reset on success
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN;
      }

      if (fallback) return fallback();
      throw error;
    }
  }
}

// Usage: one circuit breaker per EXTERNAL SERVICE dependency
const catalogCircuit = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
});

const paymentCircuit = new CircuitBreaker({
  failureThreshold: 3,       // Payments are more critical — open faster
  resetTimeoutMs: 60000,     // Wait longer before retrying
  halfOpenMaxAttempts: 2,
});
```

---

## 6. Pitfall: Data Inconsistency

### What It Is

**In a microservices architecture, data across services is EVENTUALLY consistent. If you design as if it's strongly consistent, you will have bugs.**

### Common Inconsistency Scenarios and Fixes

```typescript
// SCENARIO 1: Order placed but inventory not yet reserved
// User sees "Order Confirmed" but product is actually out of stock

// FIX: Show correct status to users
class OrderStatus {
  // Order goes through: PENDING → INVENTORY_RESERVED → PAYMENT_CAPTURED → CONFIRMED
  // Show user: "Processing your order..." until CONFIRMED

  static statusMessages: Record<string, string> = {
    PENDING: 'Processing your order...',
    INVENTORY_RESERVED: 'Processing your order...',
    PAYMENT_CAPTURED: 'Almost done...',
    CONFIRMED: 'Order confirmed!',
    CANCELLED: 'Order cancelled',
  };
}

// SCENARIO 2: Customer updates email, but notification service has old email
// FIX: Accept eventual consistency — notification service will get the update via events
// The delay is usually seconds, which is acceptable for non-critical data

// SCENARIO 3: Product price changed but order used old cached price
// FIX: Capture price at ORDER TIME as a snapshot
class OrderItem {
  constructor(
    public readonly productId: ProductId,
    public readonly quantity: Quantity,
    public readonly priceAtOrderTime: Money,  // Snapshot — never changes
    // NOT: public readonly productPrice: Money (current price — changes!)
  ) {}
}
```

---

## 7. Pitfall: Improper Service Versioning

### What It Is

**Deploying a breaking API change that crashes all consumers.**

### Versioning Rules

```
RULE 1: API changes MUST be backward compatible
  ✅ Adding new optional fields
  ✅ Adding new endpoints
  ✅ Adding new query parameters
  ❌ Removing fields
  ❌ Renaming fields
  ❌ Changing field types
  ❌ Changing endpoint URLs

RULE 2: When breaking changes are unavoidable, use URL versioning
  /api/v1/orders  ← old consumers use this
  /api/v2/orders  ← new consumers use this
  Both run simultaneously until all consumers migrate

RULE 3: Deprecation timeline
  Week 0:  Deploy v2 alongside v1
  Week 1:  Announce v1 deprecation, update consumers
  Week 4:  Monitor v1 traffic — should be near zero
  Week 6:  Remove v1 code

RULE 4: Contract tests catch breaking changes
  Consumer-driven contract tests (Pact) run in CI
  If a provider change breaks any consumer contract → build fails
```

---

## 8. Pitfall: Over-Engineering Infrastructure

### What It Is

**Adopting every CNCF project instead of building business value. You don't need Kubernetes for 3 services.**

### Infrastructure Decision Guide

```
TEAM SIZE < 10:
  Container orchestration: Docker Compose or managed PaaS (ECS, Cloud Run)
  Message broker: Managed service (Amazon SQS, Cloud Pub/Sub)
  Service mesh: NOT needed
  Observability: Managed services (CloudWatch, Datadog)
  CI/CD: GitHub Actions or GitLab CI

TEAM SIZE 10-50:
  Container orchestration: Managed Kubernetes (EKS, GKE, AKS) or ECS
  Message broker: Managed Kafka (MSK, Confluent Cloud) or RabbitMQ
  Service mesh: Consider Istio/Linkerd IF you have 20+ services
  Observability: Grafana stack or Datadog
  CI/CD: GitHub Actions + ArgoCD

TEAM SIZE > 50:
  Container orchestration: Kubernetes with custom tooling
  Message broker: Kafka (self-managed or managed)
  Service mesh: Yes (Istio, Linkerd)
  Observability: Full Grafana stack (Loki, Tempo, Mimir)
  CI/CD: Custom platform with guardrails

RULE: If you spend more than 30% of engineering time on infrastructure
instead of business logic, you have over-engineered.
```

---

## 9. Pitfall: Testing in Isolation Only

### What It Is

**Each service passes unit tests and integration tests in isolation, but the system fails when services interact.**

### Required Test Levels

```
Level 1: Unit Tests (per service)
  - Domain logic, value objects, use cases
  - Fast, no I/O, no network
  - Run: on every commit

Level 2: Integration Tests (per service)
  - Service + its own database (Testcontainers)
  - Service + its own message broker
  - Run: on every PR

Level 3: Contract Tests (between services)
  - Consumer defines expected API contract
  - Provider verifies it satisfies all consumer contracts
  - Run: on every PR

Level 4: Component Tests (per service in docker-compose)
  - Full service running with mocked dependencies
  - Test API endpoints end-to-end
  - Run: before deployment

Level 5: End-to-End Tests (whole system, staging environment)
  - Critical user journeys only (5-10 tests max)
  - Run: after deployment to staging
  - Rule: If E2E tests take > 15 minutes, you have too many
```

---

## 10. Pitfall: Ignoring Network Latency

### What It Is

**Treating remote service calls as if they are local function calls. Network calls are 1000x slower and can fail at any time.**

```
In-process function call: ~1 nanosecond
Same-machine HTTP call: ~1 millisecond (1,000x slower)
Cross-datacenter HTTP: ~10-100 milliseconds (100,000x slower)
Cross-region HTTP: ~100-300 milliseconds (300,000x slower)

RULES:
  1. MINIMIZE the number of service calls per user request
  2. BATCH requests where possible
  3. CACHE aggressively
  4. Use PARALLEL calls instead of sequential
  5. Accept EVENTUAL CONSISTENCY instead of fetching latest data
```

---

## 11. Master Anti-Pattern Checklist

| # | Pitfall | Detection Signal | Prevention |
|---|---------|-----------------|------------|
| 1 | Distributed Monolith | Must deploy together | Events, own data, independent deploy |
| 2 | Premature Decomposition | Boundaries change often | Start monolith, extract later |
| 3 | No Observability | "Where did the request go?" | Logging + tracing + metrics before prod |
| 4 | Sync Call Chains | High latency, cascading failure | Max 2 hops, use events and caching |
| 5 | No Circuit Breakers | One failure crashes everything | Circuit breaker on every external call |
| 6 | Data Inconsistency | Stale data, duplicate records | Eventual consistency by design, idempotency |
| 7 | Breaking API Changes | Consumer crashes after deploy | Backward compat, contract tests, URL versioning |
| 8 | Over-Engineering | More infra time than feature time | Right-size infrastructure for team size |
| 9 | Isolation Testing Only | "Works on my machine" | Contract tests + E2E critical paths |
| 10 | Ignoring Latency | Slow user experience | Minimize calls, parallel, cache, batch |
| 11 | No Dead Letter Queue | Messages silently disappear | DLQ on every queue, monitor and alert |
| 12 | God Service | Service with 50+ endpoints | Split by business capability |
| 13 | Shared Libraries | All services update together | Minimal shared code, contract tests |
| 14 | Missing Timeouts | Threads hang forever | Timeout on EVERY external call |
| 15 | No Idempotency | Duplicate processing | Idempotency key in every handler |
