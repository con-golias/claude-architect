# System Design: Fundamentals — Complete Specification

> **AI Plugin Directive:** System design is the practice of defining the architecture, components, interfaces, and data flow of a system to satisfy requirements. EVERY system design starts with understanding requirements (functional and non-functional), then makes trade-offs between scalability, availability, consistency, latency, and cost. There are NO perfect designs — only designs that make the RIGHT trade-offs for specific requirements.

---

## 1. The Design Process

```
STEP 1: Clarify Requirements
  Functional:    What does the system DO?
  Non-functional: How well must it do it? (performance, availability, scale)
  Constraints:   What are the limitations? (budget, team, timeline, regulations)

STEP 2: Estimate Scale
  Users:     How many? (DAU, MAU, peak concurrent)
  Traffic:   How many requests/sec? (read vs write ratio)
  Data:      How much storage? (growth rate)
  Bandwidth: How much data transfer?

STEP 3: Define High-Level Design
  Components: What services/modules exist?
  Data flow:  How does data move between components?
  APIs:       What are the interfaces?

STEP 4: Deep Dive into Components
  Database:   Schema, indexing, partitioning
  Caching:    What to cache, invalidation strategy
  Scaling:    Horizontal vs vertical, load balancing
  Reliability: Replication, failover, backups

STEP 5: Address Non-Functional Requirements
  Scalability: Can it handle 10x traffic?
  Availability: What happens when a component fails?
  Consistency: How fresh must data be?
  Security:    Authentication, authorization, encryption
```

---

## 2. Back-of-the-Envelope Estimation

```
KNOW THESE NUMBERS:

Latency:
  L1 cache reference:               0.5 ns
  RAM reference:                     100 ns
  SSD random read:                   150 μs
  HDD random read:                   10 ms
  Round trip within datacenter:      0.5 ms
  Round trip cross-continent:        150 ms

Throughput:
  SSD sequential read:               1 GB/s
  HDD sequential read:               100 MB/s
  1 Gbps network:                    125 MB/s
  Typical web server:                1,000-10,000 req/s
  Typical database server:           5,000-50,000 queries/s

Scale:
  1 million seconds ≈ 11.5 days
  1 billion seconds ≈ 31.7 years
  1 million req/day ≈ 12 req/sec
  100 million req/day ≈ 1,157 req/sec

Storage:
  1 KB  = typical JSON API response
  10 KB = typical web page
  1 MB  = typical image
  10 MB = high-res image
  1 GB  = 1 hour of SD video
```

### Quick Estimation Example

```
System: URL shortener (like bit.ly)

Requirements:
  - 100M new URLs/month (write)
  - 10B redirects/month (read) → 100:1 read/write ratio

Calculations:
  Write QPS:  100M / (30 × 24 × 3600) ≈ 40 writes/sec
  Read QPS:   10B / (30 × 24 × 3600) ≈ 3,858 reads/sec
  Peak:       3,858 × 3 (peak multiplier) ≈ 12,000 reads/sec

Storage (5 years):
  Each URL: ~500 bytes (short URL + long URL + metadata)
  Total: 100M × 12 × 5 × 500B = 3 TB

Bandwidth:
  Read: 12,000 × 500B = 6 MB/sec → manageable

Design implications:
  - Read-heavy → cache aggressively
  - 3 TB → single database is fine
  - 12K reads/sec → Redis cache handles easily
  - Simple data model → key-value store or SQL
```

---

## 3. Core Building Blocks

### Load Balancer

```
Distributes traffic across multiple server instances.

Algorithms:
  Round Robin:     Each server gets requests in turn
  Least Connections: Server with fewest active connections gets next request
  IP Hash:         Same client IP always goes to same server (sticky sessions)
  Weighted:        Servers with more capacity get more requests

Layers:
  L4 (Transport):  Routes based on IP + port (faster, TCP/UDP level)
  L7 (Application): Routes based on HTTP headers, URL path, cookies (smarter)

Options:
  Cloud:      AWS ALB/NLB, GCP Load Balancer, Azure Load Balancer
  Software:   Nginx, HAProxy, Envoy
  DNS:        Route 53, Cloudflare (global distribution)
```

### Caching

```
Cache reduces latency and database load.

Cache Locations:
  Client-side:  Browser cache, HTTP cache headers
  CDN:          Static assets close to users
  Application:  In-memory (node-cache, Redis)
  Database:     Query cache, materialized views

Strategies:
  Cache-Aside (Lazy Loading):
    1. Read from cache
    2. If miss → read from DB → write to cache
    Pro: Only caches what's actually accessed
    Con: Cache miss = slower (extra hop)

  Write-Through:
    1. Write to cache AND DB simultaneously
    Pro: Cache always consistent with DB
    Con: Write latency increased

  Write-Behind (Write-Back):
    1. Write to cache only
    2. Async: cache writes to DB periodically
    Pro: Fastest writes
    Con: Risk of data loss if cache crashes

Invalidation:
  TTL (Time-To-Live): Cache expires after N seconds
  Event-Based: Invalidate on write (publish event)
  Versioned: Cache key includes version number
```

```typescript
// Cache-Aside pattern implementation
class CachedProductRepository implements ProductRepository {
  constructor(
    private readonly cache: Redis,
    private readonly db: Database,
    private readonly ttlSeconds: number = 300,
  ) {}

  async findById(productId: string): Promise<Product | null> {
    // 1. Check cache
    const cached = await this.cache.get(`product:${productId}`);
    if (cached) return JSON.parse(cached);

    // 2. Cache miss → read from DB
    const product = await this.db.query(
      'SELECT * FROM products WHERE id = $1',
      [productId],
    );
    if (!product) return null;

    // 3. Populate cache
    await this.cache.setex(
      `product:${productId}`,
      this.ttlSeconds,
      JSON.stringify(product),
    );

    return product;
  }

  async save(product: Product): Promise<void> {
    await this.db.query('UPDATE products SET ... WHERE id = $1', [product.id]);
    // Invalidate cache
    await this.cache.del(`product:${product.id}`);
  }
}
```

### Database

```
Database Selection Guide:

Relational (PostgreSQL, MySQL):
  ✅ Complex queries, JOINs, transactions
  ✅ Strong consistency (ACID)
  ✅ Structured, predictable data
  ❌ Horizontal scaling is harder

Document (MongoDB, DynamoDB):
  ✅ Flexible schema, denormalized data
  ✅ Easy horizontal scaling
  ✅ Fast reads for entity-based access
  ❌ No JOINs, limited transactions

Key-Value (Redis, Memcached):
  ✅ Ultra-fast reads/writes
  ✅ Perfect for caching, sessions
  ❌ No complex queries
  ❌ Limited data modeling

Wide-Column (Cassandra, ScyllaDB):
  ✅ Massive write throughput
  ✅ Linear horizontal scaling
  ❌ Limited query patterns
  ❌ Eventual consistency

Graph (Neo4j, Neptune):
  ✅ Relationship-heavy queries
  ✅ Social networks, recommendations
  ❌ Not for general-purpose

Search (Elasticsearch, Algolia):
  ✅ Full-text search, faceting
  ✅ Near real-time indexing
  ❌ Not a primary data store
```

### Message Queue

```
Decouples producers and consumers for async processing.

Queue Types:
  Point-to-Point (SQS, RabbitMQ queue):
    One message → one consumer
    Use for: task distribution, work queues

  Pub/Sub (SNS, Kafka, RabbitMQ exchange):
    One message → many consumers
    Use for: event notifications, fan-out

  Log-Based (Kafka, Kinesis):
    Ordered, replayable event stream
    Use for: event sourcing, real-time analytics

Selection:
  Simple tasks → SQS (managed, easy)
  Complex routing → RabbitMQ (exchanges, dead letter)
  High throughput → Kafka (millions/sec, replay)
  Real-time streaming → Kafka or Kinesis
```

---

## 4. Scaling Patterns

```
VERTICAL SCALING (Scale Up):
  Bigger machine: more CPU, RAM, disk
  Pro: Simple, no code changes
  Con: Physical limits, single point of failure, expensive

HORIZONTAL SCALING (Scale Out):
  More machines: add instances behind load balancer
  Pro: Theoretically unlimited, fault tolerant
  Con: Requires stateless design, distributed complexity

SCALING STRATEGY:
  1. Optimize code first (profiling, caching, indexing)
  2. Vertical scale (bigger instance — simplest)
  3. Read replicas (offload read traffic)
  4. Horizontal scale (multiple instances)
  5. Shard/partition (split data across databases)
  6. Microservice extraction (scale components independently)

DATABASE SCALING:
  Replication:  Primary → Read Replicas (read scaling)
  Partitioning: Split tables by range or hash (write scaling)
  Sharding:     Split data across separate databases (massive scale)
```

---

## 5. Availability and Reliability

```
AVAILABILITY = Time system is operational / Total time

  99%     = 3.65 days downtime/year    (two nines)
  99.9%   = 8.77 hours downtime/year   (three nines)
  99.95%  = 4.38 hours downtime/year
  99.99%  = 52.6 minutes downtime/year (four nines)
  99.999% = 5.26 minutes downtime/year (five nines)

HOW TO ACHIEVE HIGH AVAILABILITY:
  1. Redundancy: Multiple instances of every component
  2. Load balancing: Distribute traffic across instances
  3. Health checks: Detect and remove unhealthy instances
  4. Failover: Automatically switch to standby on failure
  5. Geographic distribution: Deploy in multiple regions
  6. Circuit breakers: Prevent cascading failures
  7. Graceful degradation: Serve reduced functionality when partial failure

RELIABILITY PATTERNS:
  Retry with backoff:  1s → 2s → 4s → 8s → give up
  Circuit breaker:     Stop calling failing service temporarily
  Bulkhead:            Isolate failures to prevent cascade
  Timeout:             Never wait forever for a response
  Fallback:            Return cached/default data when service is down
```

---

## 6. Security Fundamentals

```
AUTHENTICATION (WHO are you?):
  - JWT tokens (stateless, scalable)
  - OAuth 2.0 / OIDC (delegated auth)
  - API keys (service-to-service)
  - mTLS (mutual TLS for internal services)

AUTHORIZATION (WHAT can you do?):
  - RBAC (Role-Based Access Control)
  - ABAC (Attribute-Based Access Control)
  - Policy engines (OPA, Casbin)

DATA PROTECTION:
  - Encrypt at rest (AES-256)
  - Encrypt in transit (TLS 1.3)
  - Encrypt sensitive fields (PII, payment data)
  - Hash passwords (bcrypt, argon2)

API SECURITY:
  - Rate limiting (prevent abuse)
  - Input validation (prevent injection)
  - CORS configuration (prevent unauthorized origins)
  - Request size limits (prevent DoS)
```

---

## 7. Monitoring and Observability

```
THE THREE PILLARS:

1. LOGS — What happened?
   Structured JSON logs with: timestamp, level, service, traceId, message
   Tools: ELK Stack, Grafana Loki, CloudWatch Logs

2. METRICS — How is it performing?
   RED method: Rate, Errors, Duration (for request-driven services)
   USE method: Utilization, Saturation, Errors (for resources)
   Tools: Prometheus + Grafana, Datadog, CloudWatch Metrics

3. TRACES — Where is the bottleneck?
   Distributed trace across services with spans
   Tools: Jaeger, Zipkin, AWS X-Ray, Datadog APM

ALERTING RULES:
  Error rate > 1% for 5 minutes → Page on-call
  P99 latency > 2 seconds → Warning
  Service health check failing → Page on-call
  Disk usage > 80% → Warning
  CPU > 90% for 10 minutes → Warning
```

---

## 8. Enforcement Checklist

- [ ] **Requirements documented** — functional, non-functional, and constraints before design
- [ ] **Scale estimated** — QPS, storage, bandwidth calculated
- [ ] **Trade-offs explicit** — document what you're optimizing for and what you're sacrificing
- [ ] **Caching strategy defined** — what to cache, TTL, invalidation method
- [ ] **Database chosen for workload** — SQL for transactions, NoSQL for scale, cache for speed
- [ ] **Scaling plan exists** — vertical first, then horizontal, with specific thresholds
- [ ] **Availability target set** — SLA defined, redundancy in place to meet it
- [ ] **Security layered** — auth, encryption, input validation, rate limiting
- [ ] **Observability complete** — logs, metrics, traces, alerts configured
- [ ] **Failure scenarios planned** — what happens when each component fails
