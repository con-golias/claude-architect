# Scaling to 1 Million Users

| Field       | Value                              |
|-------------|------------------------------------|
| Domain      | Scalability > Case Studies         |
| Importance  | High                               |
| Scope       | Progressive architecture evolution |
| Audience    | Backend engineers, architects      |
| Updated     | 2026-03-10                         |

---

## Overview

Treat scaling as a series of deliberate phase transitions, not a single leap.
Move to the next phase only when concrete signals — latency spikes, resource
saturation, deployment friction — demand it. Premature optimization wastes money;
delayed optimization causes outages.

---

## Phase 1: 0 -- 1 000 Users

### Architecture

```
 +---------------------------------------+
 |           SINGLE SERVER                |
 |  +--------+  +---------+  +--------+  |
 |  | Nginx  |->| App     |->| PgSQL  |  |
 |  | (proxy)|  |(monolith)|  |        |  |
 |  +--------+  +---------+  +--------+  |
 +---------------------------------------+
       ^  HTTPS
     Users (< 1K)
```

### Technology Stack

| Layer        | Recommendation                        |
|--------------|---------------------------------------|
| Language     | Python/Django, Node.js, or Rails      |
| Database     | PostgreSQL (single instance)          |
| Web server   | Nginx reverse proxy                   |
| Hosting      | Single VPS or small cloud instance    |
| Deployment   | Git pull or simple CI/CD pipeline     |

### Guidelines

- Deploy the entire application on one server (app + database).
- Use a managed database service if the team lacks DBA experience.
- Store static files on the same server behind Nginx.
- Implement database migrations and integration tests from day one.

### Approximate Monthly Cost

| Resource              | Estimated Cost |
|-----------------------|----------------|
| 1 x cloud VM (4 CPU) | $40 -- $80     |
| Managed PostgreSQL    | $25 -- $50     |
| Domain + DNS          | $1 -- $5       |
| **Total**             | **$70 -- $135**|

### Common Mistakes

- Over-engineering with microservices before product-market fit.
- Skipping backups and point-in-time recovery setup.
- Ignoring connection pooling (use PgBouncer even at this stage).
- Choosing a NoSQL database without a clear justification.

---

## Phase 2: 1 000 -- 10 000 Users

### Architecture

```
      Users (1K -- 10K)
            |
     +------+------+
     |   CDN       |  (static assets, images)
     | (CloudFront |
     |  / Cloudflare)
     +------+------+
            |
     +------+------+
     |   Nginx     |
     |  (reverse   |
     |   proxy)    |
     +------+------+
            |
     +------+------+
     |  App Server |
     |  (monolith) |
     +--+-------+--+
        |       |
   +----+--+ +--+----+
   | Postgr| | Redis  |
   |  eSQL | | Cache  |
   +-------+ +--------+
```

### Technology Stack Additions

| Layer        | Addition                              |
|--------------|---------------------------------------|
| Cache        | Redis (managed, e.g., ElastiCache)    |
| CDN          | Cloudflare or CloudFront              |
| Object store | S3 for user uploads                   |
| Monitoring   | Prometheus + Grafana or Datadog       |

### Guidelines

- Separate the database onto its own server or managed service.
- Introduce Redis for session storage and hot-path query caching.
- Move static assets and user uploads to object storage behind a CDN.
- Add structured logging (JSON) and centralized log aggregation.
- Implement health-check endpoints for automated monitoring.
- Set up database connection pooling with PgBouncer.

### Caching Strategy (Redis)

```python
# Example: cache-aside pattern for user profiles
import redis, json, hashlib

cache = redis.Redis(host="cache.internal", port=6379, db=0)
TTL_SECONDS = 300

def get_user_profile(user_id: int) -> dict:
    cache_key = f"user:profile:{user_id}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    profile = db.query("SELECT * FROM users WHERE id = %s", (user_id,))
    cache.setex(cache_key, TTL_SECONDS, json.dumps(profile))
    return profile

def invalidate_user_profile(user_id: int) -> None:
    cache.delete(f"user:profile:{user_id}")
```

### Approximate Monthly Cost

| Resource                 | Estimated Cost   |
|--------------------------|------------------|
| 1 x app VM (4 CPU)      | $40 -- $80       |
| Managed PostgreSQL       | $50 -- $120      |
| Managed Redis (small)    | $25 -- $50       |
| CDN                      | $20 -- $50       |
| S3 storage               | $5 -- $20        |
| Monitoring               | $30 -- $60       |
| **Total**                | **$170 -- $380** |

### Common Mistakes

- Caching without an invalidation strategy (stale data bugs).
- Not setting TTLs on every cache key.
- Storing sessions on disk instead of Redis (blocks horizontal scaling later).
- Ignoring slow-query logs in PostgreSQL.

---

## Phase 3: 10 000 -- 100 000 Users

### Architecture

```
         Users (10K -- 100K)
               |
        +------+------+
        |     CDN     |
        +------+------+
               |
        +------+------+
        | Load Balancer|  (ALB / HAProxy)
        +--+--------+--+
           |        |
     +-----+--+  +--+-----+
     | App #1 |  | App #2 |  ... App #N
     +---+----+  +----+---+
         |             |
    +----+-------------+----+
    |                       |
+---+----+           +-----+------+
| Primary|           | Read       |
| Postgr |---------->| Replica #1 |
|  eSQL  |    WAL    | Replica #2 |
+---+----+           +------------+
    |
+---+----+
| Redis  |
| Cluster|
+--------+
```

### Technology Stack Additions

| Layer           | Addition                                 |
|-----------------|------------------------------------------|
| Load balancer   | AWS ALB, HAProxy, or Nginx Plus          |
| App scaling     | Auto-scaling group (2 -- 6 instances)    |
| DB read scaling | 1 -- 2 PostgreSQL read replicas          |
| Cache           | Redis Cluster or Sentinel                |
| CI/CD           | GitHub Actions, GitLab CI, or ArgoCD     |

### Guidelines

- Place a load balancer in front of multiple application instances.
- Configure auto-scaling based on CPU utilization (target 60 -- 70%).
- Route read-heavy queries to read replicas.
- Make the application fully stateless: no local file storage, no in-memory sessions.
- Add database indexing guided by slow-query analysis.
- Introduce blue-green or rolling deployments.

### Read Replica Routing

```python
# Example: route reads vs writes in SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

primary_engine = create_engine("postgresql://primary:5432/app")
replica_engine = create_engine("postgresql://replica:5432/app")

def get_session(read_only: bool = False) -> Session:
    engine = replica_engine if read_only else primary_engine
    return Session(bind=engine)

# Usage
with get_session(read_only=True) as session:
    users = session.query(User).filter(User.active == True).all()

with get_session(read_only=False) as session:
    session.add(User(name="new_user"))
    session.commit()
```

### Approximate Monthly Cost

| Resource                     | Estimated Cost      |
|------------------------------|---------------------|
| 2 -- 4 app instances        | $160 -- $400        |
| Managed PostgreSQL + replica | $200 -- $500        |
| Redis Cluster                | $80 -- $200         |
| Load balancer                | $20 -- $40          |
| CDN + S3                     | $50 -- $150         |
| Monitoring + logging         | $100 -- $250        |
| **Total**                    | **$610 -- $1 540**  |

### Common Mistakes

- Not making the app stateless before adding load balancing.
- Using sticky sessions instead of externalizing state.
- Adding read replicas without accounting for replication lag.
- Scaling app servers while the database remains the bottleneck.

---

## Phase 4: 100 000 -- 1 000 000 Users

### Architecture

```
              Users (100K -- 1M)
                    |
             +------+------+
             |     CDN     |
             +------+------+
                    |
             +------+------+
             | API Gateway |
             +--+--+--+--+-+
                |  |  |  |
     +----------+  |  |  +----------+
     |     +-------+  +------+      |
  +--+--+  +--+--+  +--+--+  +--+--+
  |Svc A|  |Svc B|  |Svc C|  |Svc D|
  +--+--+  +--+--+  +--+--+  +--+--+
     |        |         |        |
     +--------+---------+--------+
              |         |
       +------+--+   +--+-------+
       | Message |   | Event    |
       | Queue   |   | Stream   |
       | (SQS)   |   | (Kafka)  |
       +---------+   +----------+
              |
    +---------+---------+
    |         |         |
 +--+--+  +--+--+  +---+--+
 |Shard|  |Shard|  |Shard |
 |  1  |  |  2  |  |  3   |
 +-----+  +-----+  +------+
    PostgreSQL (partitioned)
```

### Technology Stack Additions

| Layer            | Addition                                  |
|------------------|-------------------------------------------|
| API gateway      | Kong, AWS API Gateway, or Envoy           |
| Message queue    | SQS, RabbitMQ, or Redis Streams           |
| Event streaming  | Kafka or AWS Kinesis                      |
| DB partitioning  | PostgreSQL table partitioning or sharding  |
| Service mesh     | Linkerd (lightweight) or Istio            |
| Orchestration    | Kubernetes (EKS / GKE)                    |

### Guidelines

- Extract high-traffic or independently deployable domains into services.
- Use message queues to decouple write-heavy workflows (email, notifications).
- Partition the database by a natural key (tenant ID, user ID, region).
- Implement circuit breakers between services (Hystrix pattern, Resilience4j).
- Adopt infrastructure-as-code (Terraform, Pulumi) for reproducibility.
- Establish SLOs and error budgets; introduce distributed tracing (OpenTelemetry).

### Database Partitioning Example

```sql
-- PostgreSQL declarative range partitioning by created_at
CREATE TABLE orders (
    id          BIGSERIAL,
    user_id     BIGINT       NOT NULL,
    total       NUMERIC(10,2) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2025_q1 PARTITION OF orders
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE orders_2025_q2 PARTITION OF orders
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

-- Hash partitioning by user_id for even distribution
CREATE TABLE user_events (
    id       BIGSERIAL,
    user_id  BIGINT NOT NULL,
    payload  JSONB
) PARTITION BY HASH (user_id);

CREATE TABLE user_events_p0 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE user_events_p1 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE user_events_p2 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE user_events_p3 PARTITION OF user_events
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### Approximate Monthly Cost

| Resource                          | Estimated Cost        |
|-----------------------------------|-----------------------|
| Kubernetes cluster (3 -- 8 nodes) | $500 -- $2 000       |
| Managed PostgreSQL (partitioned)  | $500 -- $1 500       |
| Redis Cluster                     | $200 -- $500         |
| Kafka / SQS                       | $100 -- $400         |
| CDN + S3                          | $200 -- $600         |
| Monitoring + tracing              | $300 -- $800         |
| Load balancer + API gateway       | $50 -- $150          |
| **Total**                         | **$1 850 -- $5 950** |

### Common Mistakes

- Extracting microservices without clear domain boundaries.
- Introducing Kafka before the team understands event-driven patterns.
- Sharding the database prematurely or by the wrong key.
- Neglecting data consistency across service boundaries.

---

## Decision Checklist: When to Move to the Next Phase

| Signal                                    | Current Phase | Action              |
|-------------------------------------------|---------------|----------------------|
| P95 latency exceeds 500 ms consistently   | 1             | Move to Phase 2     |
| Database CPU above 70% during peak        | 1 or 2        | Scale DB / add cache|
| Single server cannot handle peak traffic   | 2             | Move to Phase 3     |
| Deploys require downtime                   | 2             | Move to Phase 3     |
| Read/write ratio exceeds 10:1              | 2             | Add read replicas   |
| Teams block each other on deployments      | 3             | Move to Phase 4     |
| Single DB table exceeds 500 GB             | 3             | Partition or shard  |
| Feature velocity drops due to coupling     | 3             | Extract services    |

---

## Key Takeaways

1. **Scale reactively, not speculatively.** Measure before optimizing.
2. **Stateless applications unlock horizontal scaling.** Externalize all state early.
3. **Caching provides the highest ROI** between 1K and 100K users.
4. **Database scaling is the hardest problem.** Use read replicas and partitioning
   before sharding.
5. **Each phase transition increases operational complexity.** Invest in monitoring
   and CI/CD proportionally.
6. **Cost grows non-linearly.** Budget for 3 -- 5x cost increases at each phase.
7. **Align team boundaries with service boundaries** starting at Phase 4.
