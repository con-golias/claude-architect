# Microservices Architecture — Complete Specification

> **AI Plugin Directive:** Microservices architecture decomposes a system into small, independently deployable services that communicate over the network. EVERY service MUST own its data, deploy independently, and fail independently. If a service shares a database, shares deployment, or cannot function when another service fails — it is NOT a microservice, it is a distributed monolith.

---

## 1. Core Principles

### Principle 1: Single Responsibility per Service

**Each microservice does ONE business capability. Not one CRUD entity — one business CAPABILITY.**

```
❌ WRONG: Services organized by data entity
  UserService, ProductService, OrderService, PaymentService
  → These become CRUD wrappers with no business logic

✅ CORRECT: Services organized by business capability
  IdentityService (authentication + authorization + user profiles)
  CatalogService (product listing + search + categories)
  OrderingService (cart + checkout + order lifecycle)
  PaymentService (payment processing + refunds + disputes)
  FulfillmentService (picking + packing + shipping)
  NotificationService (email + SMS + push notifications)
```

### Principle 2: Own Your Data

```
❌ NEVER: Shared database between services
┌──────────────┐  ┌──────────────┐
│ OrderService  │  │ PaymentService│
└──────┬───────┘  └──────┬───────┘
       │                  │
       └──────┬───────────┘
              ▼
       ┌─────────────┐
       │  Shared DB   │  ← VIOLATION: Two services, one database
       └─────────────┘

✅ ALWAYS: Each service owns its database
┌──────────────┐  ┌──────────────┐
│ OrderService  │  │ PaymentService│
└──────┬───────┘  └──────┬───────┘
       │                  │
       ▼                  ▼
┌─────────────┐  ┌─────────────┐
│  Orders DB   │  │ Payments DB  │  ← CORRECT: Independent data stores
└─────────────┘  └─────────────┘
```

### Principle 3: Independent Deployment

**Each service MUST be deployable without coordinating with other services.**

```yaml
# ✅ CORRECT: Each service has its own CI/CD pipeline
# ordering-service/.github/workflows/deploy.yml
name: Deploy Ordering Service
on:
  push:
    paths:
      - 'services/ordering/**'
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: docker build -t ordering-service:${{ github.sha }} ./services/ordering
      - name: Test
        run: docker run ordering-service:${{ github.sha }} npm test
      - name: Deploy
        run: kubectl set image deployment/ordering ordering=ordering-service:${{ github.sha }}
```

```
❌ NEVER deploy multiple services together:
  - "We need to deploy OrderService and PaymentService at the same time"
  - "OrderService v2.3 requires PaymentService v1.8"
  - "We have a shared library that all services must update together"

These are signs of a distributed monolith, not microservices.
```

### Principle 4: Design for Failure

```typescript
// Every call to another service CAN and WILL fail.
// ALWAYS implement: timeout, retry, circuit breaker, fallback.

// ❌ WRONG: Naive call to another service
class OrderService {
  async getProductPrice(productId: string): Promise<number> {
    const response = await fetch(`${CATALOG_URL}/products/${productId}`);
    return response.json(); // What if catalog is down? Hangs forever.
  }
}

// ✅ CORRECT: Resilient call with circuit breaker pattern
class OrderService {
  constructor(
    private readonly catalogClient: CatalogClient,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly cache: PriceCache,
  ) {}

  async getProductPrice(productId: string): Promise<Money> {
    return this.circuitBreaker.execute(
      // Primary: call catalog service
      async () => {
        const price = await this.catalogClient.getPrice(productId, {
          timeout: 3000,       // 3s timeout
          retries: 2,          // Retry twice
          retryDelay: 500,     // 500ms between retries
        });
        await this.cache.set(productId, price); // Cache successful response
        return price;
      },
      // Fallback: use cached price when circuit is open
      async () => {
        const cached = await this.cache.get(productId);
        if (!cached) throw new ProductPriceUnavailableError(productId);
        return cached;
      },
    );
  }
}
```

### Principle 5: Smart Endpoints, Dumb Pipes

```
The communication infrastructure (message broker, HTTP) should be simple.
Business logic lives in the services, NOT in the middleware.

❌ WRONG: Smart middleware
  ESB with routing rules, transformations, orchestration
  API Gateway that contains business logic
  Message broker with complex routing rules

✅ CORRECT: Dumb pipes
  HTTP/REST for synchronous communication
  Message broker for async (RabbitMQ, Kafka) — just delivers messages
  API Gateway for routing, auth, rate limiting ONLY
  All business logic inside the service
```

---

## 2. Service Structure

### Standard Microservice Project Layout

```
ordering-service/
├── src/
│   ├── domain/                    # Business logic (NO framework dependencies)
│   │   ├── entities/
│   │   │   ├── order.ts
│   │   │   ├── order-item.ts
│   │   │   └── order-status.ts
│   │   ├── value-objects/
│   │   │   ├── money.ts
│   │   │   ├── order-id.ts
│   │   │   └── quantity.ts
│   │   ├── events/
│   │   │   ├── order-placed.event.ts
│   │   │   ├── order-confirmed.event.ts
│   │   │   └── order-cancelled.event.ts
│   │   ├── ports/
│   │   │   ├── order.repository.ts         # Interface
│   │   │   ├── payment-gateway.ts          # Interface to external service
│   │   │   └── event-publisher.ts          # Interface
│   │   └── services/
│   │       └── pricing-policy.ts
│   ├── application/               # Use cases / Command & Query handlers
│   │   ├── commands/
│   │   │   ├── place-order.handler.ts
│   │   │   ├── confirm-order.handler.ts
│   │   │   └── cancel-order.handler.ts
│   │   ├── queries/
│   │   │   ├── get-order.handler.ts
│   │   │   └── list-orders.handler.ts
│   │   └── event-handlers/
│   │       ├── on-payment-received.handler.ts
│   │       └── on-inventory-reserved.handler.ts
│   ├── infrastructure/            # Frameworks, databases, external calls
│   │   ├── persistence/
│   │   │   ├── postgres/
│   │   │   │   ├── order.repository.impl.ts
│   │   │   │   ├── order.entity.ts          # ORM entity (NOT domain entity)
│   │   │   │   └── order.mapper.ts
│   │   │   └── migrations/
│   │   ├── messaging/
│   │   │   ├── kafka-event-publisher.ts
│   │   │   └── kafka-event-consumer.ts
│   │   ├── http-clients/
│   │   │   ├── payment-gateway.client.ts
│   │   │   └── catalog.client.ts
│   │   └── config/
│   │       ├── database.config.ts
│   │       └── kafka.config.ts
│   ├── api/                       # HTTP interface (controllers, DTOs)
│   │   ├── controllers/
│   │   │   └── order.controller.ts
│   │   ├── dto/
│   │   │   ├── place-order.request.ts
│   │   │   └── order.response.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── error-handler.middleware.ts
│   │   └── validators/
│   │       └── place-order.validator.ts
│   └── main.ts                    # Composition root
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/                  # Pact or similar contract tests
├── Dockerfile
├── docker-compose.yml             # Local dev dependencies
├── package.json
└── tsconfig.json
```

### Dockerfile Best Practices

```dockerfile
# Multi-stage build for minimal production image
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_modules
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
# Non-root user for security
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
COPY --from=builder /prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
USER appuser
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

---

## 3. API Design Rules

### REST API Conventions

```
Every microservice exposes a REST API following these rules:

1. Resource naming: plural nouns, kebab-case
   ✅ /orders, /order-items, /payment-methods
   ❌ /order, /orderItems, /getPayments

2. HTTP methods map to operations:
   GET    /orders          → List orders (with pagination)
   GET    /orders/:id      → Get single order
   POST   /orders          → Create order
   PUT    /orders/:id      → Full update (idempotent)
   PATCH  /orders/:id      → Partial update
   DELETE /orders/:id      → Delete/cancel

3. Status codes are meaningful:
   200 OK            → Successful GET/PUT/PATCH
   201 Created       → Successful POST (include Location header)
   204 No Content    → Successful DELETE
   400 Bad Request   → Validation error (client's fault)
   401 Unauthorized  → Missing or invalid auth token
   403 Forbidden     → Valid token but insufficient permissions
   404 Not Found     → Resource doesn't exist
   409 Conflict      → State conflict (e.g., order already cancelled)
   422 Unprocessable → Business rule violation
   429 Too Many Req  → Rate limited
   500 Internal      → Server error (never expose internals)
   502 Bad Gateway   → Upstream service error
   503 Unavailable   → Service temporarily down

4. Versioning: URL prefix
   /api/v1/orders, /api/v2/orders
   NOT: Header-based versioning (hard to test, debug, cache)

5. Pagination: cursor-based for large datasets
   GET /orders?cursor=eyJpZCI6MTAwfQ&limit=20
   Response: { data: [...], nextCursor: "eyJpZCI6MTIwfQ", hasMore: true }
```

### Standard Error Response

```typescript
// EVERY microservice MUST return errors in this format
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable: 'ORDER_NOT_FOUND'
    message: string;        // Human-readable: 'Order with ID ord-123 not found'
    details?: ErrorDetail[];// Validation errors
    traceId: string;        // Correlation ID for distributed tracing
  };
}

interface ErrorDetail {
  field: string;    // 'items[0].quantity'
  code: string;     // 'INVALID_RANGE'
  message: string;  // 'Quantity must be between 1 and 100'
}

// Example
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "items[0].quantity", "code": "MIN_VALUE", "message": "Quantity must be at least 1" },
      { "field": "shippingAddress.postalCode", "code": "REQUIRED", "message": "Postal code is required" }
    ],
    "traceId": "abc-123-def-456"
  }
}
```

### Health Check Endpoints

```typescript
// EVERY microservice MUST expose these endpoints

// Liveness probe: Is the process running?
// GET /health/live → 200 OK or 503
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe: Can the service handle requests?
// GET /health/ready → 200 OK or 503
app.get('/health/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkMessageBroker(),
    checkCacheConnection(),
  ]);

  const allHealthy = checks.every(c => c.status === 'fulfilled');
  const status = allHealthy ? 200 : 503;

  res.status(status).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      messageBroker: checks[1].status === 'fulfilled' ? 'up' : 'down',
      cache: checks[2].status === 'fulfilled' ? 'up' : 'down',
    },
  });
});
```

---

## 4. Service Configuration

### Externalized Configuration

```typescript
// NEVER hardcode configuration. ALWAYS use environment variables.
// NEVER commit secrets to source control.

// config/app.config.ts
interface AppConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;        // From secrets manager in production
    maxConnections: number;
    connectionTimeout: number;
  };
  kafka: {
    brokers: string[];
    groupId: string;
    clientId: string;
  };
  services: {
    catalogUrl: string;
    paymentUrl: string;
  };
  resilience: {
    circuitBreakerThreshold: number;
    timeoutMs: number;
    retryAttempts: number;
  };
}

function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000'),
    environment: (process.env.NODE_ENV || 'development') as AppConfig['environment'],
    database: {
      host: requireEnv('DB_HOST'),
      port: parseInt(requireEnv('DB_PORT')),
      name: requireEnv('DB_NAME'),
      username: requireEnv('DB_USER'),
      password: requireEnv('DB_PASSWORD'),
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    },
    kafka: {
      brokers: requireEnv('KAFKA_BROKERS').split(','),
      groupId: requireEnv('KAFKA_GROUP_ID'),
      clientId: `ordering-service-${process.env.HOSTNAME || 'local'}`,
    },
    services: {
      catalogUrl: requireEnv('CATALOG_SERVICE_URL'),
      paymentUrl: requireEnv('PAYMENT_SERVICE_URL'),
    },
    resilience: {
      circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
      timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '3000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    },
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
```

---

## 5. Observability — The Three Pillars

### Structured Logging

```typescript
// EVERY log entry MUST be structured JSON with correlation IDs

import { Logger } from './logger';

// ✅ CORRECT: Structured log with context
logger.info('Order placed successfully', {
  orderId: 'ord-123',
  customerId: 'cust-456',
  totalAmount: 59.99,
  currency: 'USD',
  itemCount: 3,
  traceId: context.traceId,
  spanId: context.spanId,
  service: 'ordering-service',
  duration: 145,
});

// Output:
// {"level":"info","message":"Order placed successfully","orderId":"ord-123",
//  "customerId":"cust-456","totalAmount":59.99,"currency":"USD","itemCount":3,
//  "traceId":"abc-123","spanId":"def-456","service":"ordering-service",
//  "duration":145,"timestamp":"2024-01-15T10:30:00.000Z"}

// ❌ WRONG: Unstructured log
console.log(`Order ord-123 placed for customer cust-456, total: $59.99`);
// → Cannot query, filter, or alert on this
```

### Distributed Tracing

```typescript
// Propagate trace context across ALL service calls

// Middleware to extract/create trace context
function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = req.headers['x-trace-id'] as string || generateTraceId();
  const parentSpanId = req.headers['x-span-id'] as string;
  const spanId = generateSpanId();

  req.context = {
    traceId,
    spanId,
    parentSpanId,
  };

  // Propagate in response headers
  res.setHeader('x-trace-id', traceId);
  res.setHeader('x-span-id', spanId);

  next();
}

// When calling other services, ALWAYS pass trace context
class CatalogClient {
  async getProduct(productId: string, context: TraceContext): Promise<Product> {
    return this.http.get(`${this.baseUrl}/products/${productId}`, {
      headers: {
        'x-trace-id': context.traceId,
        'x-span-id': context.spanId,
      },
    });
  }
}
```

### Metrics

```typescript
// EVERY service MUST expose Prometheus-compatible metrics

// Key metrics to track:
// 1. Request rate (RED method)
//    - Rate: requests per second
//    - Errors: error rate per second
//    - Duration: request latency histogram

// 2. Resource usage (USE method)
//    - Utilization: CPU, memory, disk, connections
//    - Saturation: queue depth, thread pool usage
//    - Errors: connection failures, OOM events

import { Counter, Histogram, Gauge } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new Gauge({
  name: 'db_active_connections',
  help: 'Number of active database connections',
});

// Middleware to record metrics
function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = { method: req.method, route: req.route?.path || 'unknown', status_code: res.statusCode.toString() };
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });
  next();
}
```

---

## 6. Service Deployment Topology

```
                        ┌────────────────────┐
                        │   Load Balancer     │
                        │   (AWS ALB / Nginx) │
                        └─────────┬──────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   API Gateway       │
                        │   (Kong / AWS APIGW)│
                        │   - Auth validation │
                        │   - Rate limiting   │
                        │   - Request routing │
                        └─────────┬──────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌────────▼────────┐  ┌───────▼────────┐  ┌────────▼────────┐
   │ Ordering (x3)   │  │ Catalog (x2)   │  │ Payment (x2)    │
   │ Port: 3001      │  │ Port: 3002     │  │ Port: 3003      │
   └────────┬────────┘  └───────┬────────┘  └────────┬────────┘
            │                   │                     │
   ┌────────▼────────┐  ┌──────▼─────────┐  ┌───────▼─────────┐
   │ Orders DB       │  │ Catalog DB     │  │ Payments DB     │
   │ PostgreSQL      │  │ PostgreSQL     │  │ PostgreSQL      │
   └─────────────────┘  │ + Elasticsearch│  └─────────────────┘
                        └────────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   Message Broker    │
                        │   (Kafka / RabbitMQ)│
                        └────────────────────┘
```

---

## 7. Testing Strategy

### Testing Pyramid for Microservices

```
                    ╱╲
                   ╱  ╲           E2E Tests (few)
                  ╱    ╲          - Full user journeys across services
                 ╱──────╲         - Slow, expensive, flaky
                ╱        ╲
               ╱ Contract ╲       Contract Tests (medium)
              ╱   Tests    ╲      - Verify API contracts between services
             ╱──────────────╲     - Pact, Spring Cloud Contract
            ╱                ╲
           ╱  Integration     ╲   Integration Tests (medium)
          ╱    Tests           ╲  - Service + database, service + message broker
         ╱──────────────────────╲ - Use Testcontainers for real dependencies
        ╱                        ╲
       ╱      Unit Tests          ╲ Unit Tests (many)
      ╱                            ╲ - Domain logic, use cases, value objects
     ╱──────────────────────────────╲ - Fast, no I/O, no framework
```

### Contract Testing Example (Pact)

```typescript
// Consumer side (ordering-service needs catalog-service)
describe('Catalog Service Contract', () => {
  const provider = new PactV3({
    consumer: 'ordering-service',
    provider: 'catalog-service',
  });

  it('should return product details', async () => {
    provider
      .given('product prod-123 exists')
      .uponReceiving('a request for product details')
      .withRequest({
        method: 'GET',
        path: '/api/v1/products/prod-123',
      })
      .willRespondWith({
        status: 200,
        body: {
          id: 'prod-123',
          name: like('Widget'),
          price: { amount: like(29.99), currency: like('USD') },
          available: like(true),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new CatalogClient(mockServer.url);
      const product = await client.getProduct('prod-123');
      expect(product.id).toBe('prod-123');
      expect(product.price.amount).toBeDefined();
    });
  });
});
```

---

## 8. When to Use Microservices — Quick Decision

```
MICROSERVICES ARE RIGHT WHEN:
  ✅ Team size > 20 developers
  ✅ Multiple teams need to deploy independently
  ✅ Different parts of the system have wildly different scaling needs
  ✅ Different parts need different tech stacks
  ✅ Organization is mature in DevOps (CI/CD, monitoring, containerization)
  ✅ System complexity justifies the operational overhead

MICROSERVICES ARE WRONG WHEN:
  ❌ Team size < 10 developers
  ❌ You're building an MVP or prototype
  ❌ You don't have strong DevOps capabilities
  ❌ The domain is not well understood
  ❌ "Because Netflix does it" is the reason
  ❌ You can't afford the operational complexity

START WITH: Modular monolith → Extract to microservices when proven necessary
```

---

## 9. Anti-Pattern Quick Reference

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Distributed Monolith** | Services must deploy together | Decouple via events, eliminate shared DB |
| **Shared Database** | Multiple services read/write same tables | Database per service, sync via events |
| **Synchronous Chain** | Service A calls B calls C calls D | Use async events, saga pattern |
| **God Service** | One service with 50+ endpoints | Split by business capability |
| **Nano-services** | Service with one endpoint and no logic | Merge into related service |
| **Chatty Services** | 20+ calls between services for one operation | Redesign boundaries, use batch APIs |
| **No Service Discovery** | Hardcoded service URLs | Use DNS-based or registry-based discovery |
| **Missing Circuit Breaker** | One service failure cascades to all | Add circuit breakers on all external calls |
| **Log and Pray** | No structured logging, no tracing | Implement three pillars of observability |
| **Big Bang Migration** | Rewrite entire monolith as microservices at once | Strangler Fig pattern: migrate one service at a time |

---

## 10. Enforcement Checklist

- [ ] **Each service has its own database** — no shared tables, no shared schemas
- [ ] **Each service deploys independently** — own CI/CD pipeline, own Dockerfile
- [ ] **Each service has health endpoints** — /health/live and /health/ready
- [ ] **All external calls have resilience** — timeout, retry, circuit breaker
- [ ] **Structured logging with correlation IDs** — every log entry is JSON with traceId
- [ ] **Distributed tracing enabled** — trace context propagated across all calls
- [ ] **Metrics exposed** — Prometheus-compatible /metrics endpoint
- [ ] **Contract tests exist** — Pact or equivalent between consumer and provider
- [ ] **Configuration externalized** — environment variables, no hardcoded values
- [ ] **API follows REST conventions** — proper status codes, error format, versioning
- [ ] **Events have schemas** — versioned, backward-compatible event schemas
- [ ] **No synchronous chains** — maximum 2 sync hops, prefer async
