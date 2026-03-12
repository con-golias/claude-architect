# Scaling to 100 Million Users

| Field       | Value                                       |
|-------------|---------------------------------------------|
| Domain      | Scalability > Case Studies                  |
| Importance  | High                                        |
| Scope       | Architecture patterns for 1M -- 100M users  |
| Audience    | Senior engineers, principal architects       |
| Updated     | 2026-03-10                                  |

---

## Overview

Scaling beyond one million users demands a fundamentally different approach. Treat
the system as a distributed organism — not a collection of servers. Optimize for
global latency, organizational autonomy, and cost efficiency simultaneously.
Every decision at this scale has compounding effects on reliability, velocity,
and operational cost.

---

## Core Challenges at 100M Scale

| Challenge              | Why It Matters                                     |
|------------------------|----------------------------------------------------|
| Global latency         | Users span continents; 200 ms+ RTT is unacceptable |
| Data gravity           | Petabytes of data resist migration                  |
| Organizational scaling | 100+ engineers must ship independently              |
| Cost management        | Cloud bills reach $500K -- $5M+/month               |
| Reliability            | Minutes of downtime affect millions of users        |
| Compliance             | GDPR, SOC2, data residency laws per region          |

---

## Global Distribution Architecture

### Multi-Region Design

```
                        Global DNS (Route 53 / Cloudflare)
                        Latency-based routing
                               |
            +------------------+------------------+
            |                  |                  |
     +------+------+   +------+------+   +------+------+
     |  US-EAST    |   |  EU-WEST    |   |  AP-SOUTH   |
     |  Region     |   |  Region     |   |  Region     |
     +------+------+   +------+------+   +------+------+
            |                  |                  |
     +------+------+   +------+------+   +------+------+
     | Edge / CDN  |   | Edge / CDN  |   | Edge / CDN  |
     | (PoPs)      |   | (PoPs)      |   | (PoPs)      |
     +------+------+   +------+------+   +------+------+
            |                  |                  |
     +------+------+   +------+------+   +------+------+
     | K8s Cluster |   | K8s Cluster |   | K8s Cluster |
     | + Service   |   | + Service   |   | + Service   |
     |   Mesh      |   |   Mesh      |   |   Mesh      |
     +------+------+   +------+------+   +------+------+
            |                  |                  |
     +------+------+   +------+------+   +------+------+
     | Data Plane  |   | Data Plane  |   | Data Plane  |
     | CockroachDB |<->| CockroachDB |<->| CockroachDB |
     | Kafka       |   | Kafka       |   | Kafka       |
     | Redis       |   | Redis       |   | Redis       |
     +-------------+   +-------------+   +-------------+
```

### Guidelines for Multi-Region

- Use latency-based DNS routing to direct users to the nearest region.
- Deploy stateless services identically across all regions.
- Choose a multi-region database (CockroachDB, Spanner) or accept eventual
  consistency with async replication.
- Replicate event streams (Kafka MirrorMaker) across regions for analytics.
- Store user data in the region closest to the user (data residency).
- Design every service to tolerate a full region failure.

---

## Database Scaling at 100M

### Sharding Strategy

```
                    +-------------------+
                    |  Application      |
                    |  Shard Router     |
                    +---+------+----+---+
                        |      |    |
              +---------+  +---+    +----------+
              |            |                   |
        +-----+----+ +----+-----+  +----------+---+
        | Shard 0  | | Shard 1  |  | Shard N      |
        | user_id  | | user_id  |  | user_id      |
        | 0 - 999  | | 1K - 1999|  | (N-1)K - NK  |
        +-----+----+ +----+-----+  +----------+---+
              |            |                   |
        +-----+----+ +----+-----+  +----------+---+
        | Replica  | | Replica  |  | Replica      |
        +----------+ +----------+  +--------------+
```

### Polyglot Persistence

Use the right database for each workload. Do not force one engine to handle
every access pattern.

| Workload              | Database            | Rationale                        |
|-----------------------|---------------------|----------------------------------|
| User profiles, billing| CockroachDB/Spanner | Strong consistency, multi-region |
| Social graph          | Neo4j / Dgraph      | Native graph traversal           |
| Session / cache       | Redis Cluster        | Sub-millisecond reads            |
| Time-series metrics   | TimescaleDB / QuestDB| Optimized for append + range    |
| Full-text search      | Elasticsearch        | Inverted index, relevance scoring|
| Event log / audit     | Kafka + S3 (Parquet) | Append-only, cheap storage       |
| Media metadata        | Cassandra            | High write throughput, tunable   |

### NewSQL Configuration Example (CockroachDB)

```sql
-- Create a multi-region database
CREATE DATABASE app_db
    PRIMARY REGION "us-east1"
    REGIONS "eu-west1", "ap-south1"
    SURVIVE REGION FAILURE;

-- Pin latency-sensitive tables to the user's region
ALTER TABLE user_profiles
    SET LOCALITY REGIONAL BY ROW AS region_col;

-- Use global tables for low-write reference data
ALTER TABLE currency_rates
    SET LOCALITY GLOBAL;
```

---

## Async Processing and Event-Driven Architecture

### Stream Processing Pipeline

```
  Producers              Broker             Consumers
 +--------+         +-----------+        +-----------+
 | API    |-------->|           |------->| Analytics |
 | Server |         |  Kafka    |        | Pipeline  |
 +--------+         |  Cluster  |        +-----------+
 +--------+         |           |        +-----------+
 | Mobile |-------->| (100+     |------->| Notif.    |
 | Events |         |  partitions|       | Service   |
 +--------+         |  per topic)|       +-----------+
 +--------+         |           |        +-----------+
 | IoT    |-------->|           |------->| ML Feature|
 | Sensors|         +-----------+        | Store     |
 +--------+              |              +-----------+
                          |
                    +-----+-----+
                    | S3 / HDFS |
                    | (cold     |
                    |  storage) |
                    +-----------+
```

### Guidelines for Event Streaming

- Size Kafka partitions so that each consumer processes no more than
  10 000 events/second per partition.
- Use Avro or Protobuf with a schema registry for all event payloads.
- Guarantee at-least-once delivery; design consumers to be idempotent.
- Set retention policies per topic: 7 days for operational, 90 days for analytics.
- Monitor consumer lag as a primary health metric.

### Idempotent Consumer Pattern

```python
# Ensure events are processed exactly once using an idempotency key
from datetime import timedelta

def process_event(event: dict) -> None:
    idempotency_key = event["event_id"]

    # Atomic check-and-set in Redis with TTL
    already_processed = redis.set(
        f"processed:{idempotency_key}",
        "1",
        nx=True,  # set only if not exists
        ex=timedelta(days=7)
    )
    if not already_processed:
        return  # duplicate, skip

    # Process the event
    handle_order_created(event["payload"])
```

---

## Infrastructure at Scale

### Kubernetes and Service Mesh

```
 +----------------------------------------------------------+
 |  Kubernetes Cluster (per region)                         |
 |                                                          |
 |  +---------------------------------------------------+  |
 |  | Istio Service Mesh (mTLS, traffic management)     |  |
 |  |                                                   |  |
 |  |  +---------+  +---------+  +---------+           |  |
 |  |  | Svc A   |  | Svc B   |  | Svc C   |           |  |
 |  |  | 20 pods |  | 50 pods |  | 10 pods |           |  |
 |  |  +----+----+  +----+----+  +----+----+           |  |
 |  |       |             |           |                 |  |
 |  |  +----+-------------+-----------+----+            |  |
 |  |  |     Envoy sidecar proxies         |            |  |
 |  |  +-----------------------------------+            |  |
 |  +---------------------------------------------------+  |
 |                                                          |
 |  +------------------+  +-----------------------------+   |
 |  | Observability    |  | Platform Services           |   |
 |  | - Prometheus     |  | - Cert Manager              |   |
 |  | - Grafana        |  | - External DNS              |   |
 |  | - Jaeger         |  | - Sealed Secrets            |   |
 |  | - Loki           |  | - ArgoCD                    |   |
 |  +------------------+  +-----------------------------+   |
 +----------------------------------------------------------+
```

### Observability Stack

| Layer         | Tool                 | Purpose                          |
|---------------|----------------------|----------------------------------|
| Metrics       | Prometheus + Thanos  | Long-term metrics, multi-cluster |
| Dashboards    | Grafana              | Visualization, alerting          |
| Tracing       | Jaeger / Tempo       | Distributed request tracing      |
| Logging       | Loki or Elasticsearch| Structured log aggregation       |
| Alerting      | PagerDuty + Opsgenie | On-call routing, escalation      |
| SLO tracking  | Sloth or Nobl9       | Error budget burn-rate alerts    |

---

## Organizational Scaling

### Team Topology

Align team boundaries with system boundaries. Each team owns a bounded context
end-to-end: code, data, deployment, and on-call.

| Team Type          | Responsibility                              | Example          |
|--------------------|---------------------------------------------|------------------|
| Stream-aligned     | Owns a user-facing product feature          | Payments team    |
| Platform           | Provides shared infra as internal product   | K8s platform     |
| Enabling           | Coaches stream-aligned teams on practices   | SRE enablement   |
| Complicated subsys.| Owns deep-expertise components              | ML ranking team  |

### Guidelines

- Limit each team to 5 -- 8 engineers (two-pizza rule).
- Give each stream-aligned team its own deployment pipeline.
- Define team APIs (service contracts) as strictly as external APIs.
- Conduct architecture reviews only at team-boundary integration points.

---

## Lessons from Industry

### Netflix (200M+ users)

- Pioneered chaos engineering (Chaos Monkey, Chaos Kong).
- Built EVCache (memcached-based) for sub-millisecond reads.
- Runs 1 000+ microservices on a custom cloud-native platform.
- Lesson: **invest in developer tooling early** — internal platforms
  accelerate velocity at scale.

### Uber (130M+ users)

- Moved from monolith to domain-oriented microservice architecture (DOMA).
- Built Ringpop for consistent hashing and peer-to-peer service discovery.
- Uses Schemaless (MySQL-backed) and Docstore for flexible storage.
- Lesson: **domain boundaries matter more than technology choices.**

### Discord (200M+ users)

- Migrated hot-path services from Go to Rust for predictable latency.
- Shards by guild (server) ID for data locality.
- Uses Elixir for real-time WebSocket fanout.
- Lesson: **choose languages by workload profile** — GC pauses matter
  at the tail latency.

---

## Cost Management at Scale (FinOps)

| Strategy              | Savings Potential | Complexity |
|-----------------------|-------------------|------------|
| Reserved instances    | 30 -- 60%         | Low        |
| Spot / preemptible    | 60 -- 90%         | Medium     |
| Right-sizing          | 15 -- 30%         | Low        |
| Auto-scaling policies | 20 -- 40%         | Medium     |
| Data lifecycle (tier) | 40 -- 70%         | Medium     |
| Multi-cloud arbitrage | 10 -- 20%         | High       |

### Guidelines

- Tag every resource with team, environment, and cost center.
- Review cloud spend weekly with engineering leads.
- Set per-team budgets and alert at 80% utilization.
- Use spot instances for stateless workloads and batch processing.
- Archive cold data to S3 Glacier or equivalent after 90 days.
- Negotiate enterprise discount programs (EDPs) above $1M/year spend.

---

## Decision Framework: When to Invest in What

| User Count   | Primary Investment Area                        |
|--------------|------------------------------------------------|
| 1M -- 5M    | Multi-AZ, read replicas, caching layer         |
| 5M -- 20M   | Sharding, async processing, first microservices |
| 20M -- 50M  | Multi-region, service mesh, platform team       |
| 50M -- 100M | Edge computing, FinOps, chaos engineering       |

---

## Key Takeaways

1. **Go multi-region before users demand it.** Latency is a feature.
2. **Adopt polyglot persistence.** No single database handles all access patterns
   at 100M scale.
3. **Event-driven architecture decouples teams and systems.** Kafka or equivalent
   becomes the central nervous system.
4. **Organizational design is as important as system design.** Conway's Law is
   not optional — use it deliberately.
5. **FinOps is an engineering discipline.** Treat cost as a non-functional
   requirement with the same rigor as latency or availability.
6. **Observability is not optional.** Instrument everything with metrics, traces,
   and structured logs from day one at this scale.
7. **Chaos engineering validates assumptions.** Regularly inject failures to prove
   the system recovers as designed.
