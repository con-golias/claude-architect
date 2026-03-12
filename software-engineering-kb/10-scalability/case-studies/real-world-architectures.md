# Real-World Scaling Architectures

| Field       | Value                                     |
|-------------|-------------------------------------------|
| Domain      | Scalability > Case Studies                |
| Importance  | High                                      |
| Scope       | Architecture patterns from proven systems |
| Audience    | Engineers, architects, tech leads         |
| Updated     | 2026-03-10                                |

---

## Overview

Study real-world architectures to extract transferable principles, not to copy
them. Every system here evolved through production incidents and hard trade-offs.
Focus on the reasoning behind each decision, not the specific technology.

---

## 1. Discord

### Context

- 200M+ monthly active users, 4B+ messages/day.
- Real-time messaging with sub-100 ms delivery requirement.
- Massive fan-out: one message delivered to thousands of guild members.

### Architecture

```
  Mobile / Desktop Clients
           |
    +------+------+
    | API Gateway  |
    +------+------+
           |
    +------+------+          +---------------+
    | Guilds      |          | Voice / Video |
    | Service     |          | (WebRTC + SFU)|
    | (Elixir)    |          +---------------+
    +------+------+
           |
    +------+------+
    | Guild       |  Shard key: guild_id
    | Sharding    |  Each shard = one Elixir process
    +--+-------+--+
       |       |
  +----+--+ +--+------+
  | Msg   | | Presence |
  | Store | | Service  |
  | Cass- | | (Elixir) |
  | andra | +----------+
  +-------+
       |
  +----+------+
  | Scylla /  |  Hot path: recent messages
  | Cassandra |  Cold path: archived to S3
  +-----------+
```

### Key Decisions

| Decision                         | Rationale                                   |
|----------------------------------|---------------------------------------------|
| Elixir for real-time fan-out     | BEAM VM handles millions of concurrent procs|
| Rust for hot-path read services  | Eliminates GC pauses at tail latencies      |
| Cassandra for message storage    | High write throughput, tunable consistency   |
| Guild-based sharding             | Natural isolation unit, avoids cross-shard   |
| Lazy loading of message history  | Reduces memory; load on scroll              |

### Lessons

- **GC-free languages matter for latency-critical paths.** Discord's migration from
  Go to Rust for read states eliminated P99 latency spikes caused by Go's GC.
- **Shard by the natural domain boundary.** Guild-based sharding keeps related data
  co-located and avoids distributed joins.
- **Elixir's actor model maps naturally to chat.** Each guild is a process with
  crash isolation.

---

## 2. Netflix

### Context

- 260M+ subscribers across 190+ countries.
- 17 000+ titles, personalized per user.
- Streams 20%+ of global internet traffic during peak hours.

### Architecture

```
  User Devices (Smart TVs, phones, browsers)
           |
    +------+------+
    | Open Connect|  Netflix's own CDN
    | CDN (OCA)   |  Appliances in ISP networks
    +------+------+
           |
    +------+------+
    | Zuul        |  API gateway + routing
    | Gateway     |  Canary deployments
    +------+------+
           |
    +------+------+
    | Microservices (1000+)                     |
    |                                           |
    | +----------+ +----------+ +----------+   |
    | | User     | | Content  | | Recommend|   |
    | | Profile  | | Catalog  | | ation    |   |
    | +----+-----+ +----+-----+ +----+-----+   |
    |      |            |            |          |
    | +----+-----+ +----+-----+ +---+------+   |
    | | EVCache  | | Cassandra | | Spark /  |   |
    | | (memcache| | (content  | | Flink    |   |
    | |  wrapper)| |  metadata)| | (ML)     |   |
    | +----------+ +----------+ +----------+   |
    +-------------------------------------------+
```

### Key Decisions

| Decision                          | Rationale                                    |
|-----------------------------------|----------------------------------------------|
| Own CDN (Open Connect)            | Control over video delivery at ISP level      |
| EVCache over raw Memcached        | Added replication, zone awareness, warm-up    |
| Cassandra for catalog + history   | AP system, multi-region replication            |
| Zuul gateway for all traffic      | Centralized auth, rate limiting, canary       |
| Chaos Monkey / Chaos Kong         | Continuous failure injection builds resilience |

### Technology Stack

| Component          | Technology                                     |
|--------------------|------------------------------------------------|
| API gateway        | Zuul 2 (Netty-based, non-blocking)             |
| Caching            | EVCache (Memcached + replication)               |
| Database           | Cassandra, MySQL (billing), CockroachDB        |
| Stream processing  | Apache Flink, Kafka                            |
| ML platform        | Metaflow, Spark                                |
| Deployment         | Spinnaker (continuous delivery)                |
| Observability      | Atlas (metrics), Mantis (stream processing)    |

### Lessons

- **Build your own CDN when content delivery is the product.** Netflix serves
  video from appliances physically inside ISP data centers.
- **Caching at every layer eliminates database load.** EVCache serves millions
  of requests/second with sub-millisecond latency.
- **Chaos engineering must be continuous, not quarterly.** Netflix runs Chaos
  Monkey in production continuously; failures become routine.

---

## 3. Slack

### Context

- 40M+ daily active users, 750K+ organizations.
- Real-time messaging with persistent history.
- Channel-based communication model.

### Architecture

```
  Desktop / Mobile / Web Clients
           |
    +------+------+
    | Edge Proxy  |  TLS termination, rate limiting
    +------+------+
           |
    +------+------+
    | API Servers |  Migrated from PHP to Hack (HHVM)
    | (Hack/PHP)  |  then to modern services
    +------+------+
           |
    +------+------+------+------+
    |      |      |      |      |
  +-+-+  +-+-+  +-+-+  +-+-+  +-+-+
  |Ch |  |Msg|  |Srch|  |Job|  |RTM|
  |Svc|  |Svc|  |Svc|  |Q  |  |Svc|
  +---+  +---+  +---+  +---+  +---+
    |      |      |      |      |
  +-+-+  +-+-+  +-+-+  +-+-+  +-+-+
  |SQL|  |SQL|  | ES |  |Redis| |WS |
  |   |  |   |  |    |  |    |  |   |
  +---+  +---+  +----+  +----+  +---+
    MySQL (sharded by workspace)
```

### Key Decisions

| Decision                            | Rationale                                 |
|-------------------------------------|-------------------------------------------|
| PHP to Hack migration               | Type safety and performance at scale      |
| Shard by workspace (organization)   | Natural isolation, simplifies compliance  |
| Redis for job queues                 | Fast enqueue/dequeue, reliable enough     |
| Vitess for MySQL sharding           | Horizontal MySQL scaling without app changes|
| Dedicated search cluster (ES)       | Full-text search decoupled from main DB   |

### Lessons

- **Shard by the billing entity (workspace).** Workspace-based sharding gives
  natural tenant isolation and simplifies enterprise data handling.
- **Invest in job queues early.** Slack processes billions of async jobs/day
  (notifications, indexing, webhooks) through Redis-backed queues.
- **Gradual language migration works.** The PHP-to-Hack migration happened
  incrementally over years, not as a big-bang rewrite.

---

## 4. Instagram

### Context

- 2B+ monthly active users.
- 100M+ photos uploaded daily.
- Feed generation for billions of users.

### Architecture

```
  Mobile Clients (iOS, Android)
           |
    +------+------+
    | Load        |  L7 load balancing
    | Balancer    |
    +------+------+
           |
    +------+------+
    | Django      |  Python / Django (kept since inception)
    | App Servers |  Async workers via Celery
    +------+------+
           |
    +------+------+------+------+
    |      |      |      |      |
  +-+-+  +-+-+  +-+-+  +-+-+  +-+-+
  |PG |  |Cass|  |Redis| |Memcache| ES|
  |SQL|  |ndra|  |     | |       | |  |
  +---+  +----+  +-----+ +-------+ +--+
    |
  Sharded by user_id (12+ shards)
```

### Key Decisions

| Decision                            | Rationale                                    |
|-------------------------------------|----------------------------------------------|
| Django monolith (still in use)      | Proven, large ecosystem, team familiarity     |
| PostgreSQL sharding (user_id)       | Strong consistency for user data              |
| Cassandra for feeds and likes       | High write throughput, eventual consistency   |
| Celery for async tasks              | Integrates with Django, handles millions/day  |
| Memcached (via McRouter) for cache  | Facebook's battle-tested caching layer        |

### Lessons

- **A monolith can scale to billions.** Instagram proves that monolithic Django
  can handle 2B users with proper caching and database sharding.
- **Shard PostgreSQL rather than abandon it.** Instagram built custom sharding
  middleware rather than migrating to a different database.
- **Use existing infrastructure when inside a larger organization.** Instagram
  leveraged Meta's Memcached, TAO, and networking expertise.

---

## 5. Uber

### Context

- 130M+ monthly active users across 70+ countries.
- Real-time matching of riders and drivers.
- Millions of concurrent location updates per second.

### Architecture

```
  Rider App          Driver App
     |                   |
     +--------+----------+
              |
       +------+------+
       | API Gateway  |
       +------+------+
              |
       +------+------+
       | Domain-Oriented Microservice Architecture (DOMA)  |
       |                                                   |
       |  +----------+  +----------+  +----------+        |
       |  | Matching |  | Pricing  |  | Maps     |        |
       |  | Domain   |  | Domain   |  | Domain   |        |
       |  +----+-----+  +----+-----+  +----+-----+        |
       |       |              |             |              |
       |  +----+-----+  +----+-----+  +----+-----+        |
       |  | Ringpop  |  | Schemaless|  | H3 Geo  |        |
       |  | (hash    |  | (flexible |  | Index   |        |
       |  |  ring)   |  |  storage) |  |         |        |
       |  +----------+  +----------+  +----------+        |
       +---------------------------------------------------+
```

### Key Decisions

| Decision                             | Rationale                                  |
|--------------------------------------|--------------------------------------------|
| DOMA (domain-oriented microservices) | Reduce inter-team coupling at 2000+ engs   |
| Ringpop (consistent hashing)         | Stateful routing without central coordinator|
| Schemaless (MySQL-backed)            | Schema flexibility with relational durability|
| H3 hexagonal geo-indexing            | Efficient spatial queries for ride matching |
| Cadence (workflow engine)            | Orchestrate multi-step business processes   |

### Lessons

- **Domain-oriented architecture tames microservice sprawl.** DOMA groups
  services into domains with explicit gateway APIs, reducing the N-squared
  communication problem.
- **Build custom infrastructure only when off-the-shelf fails at your scale.**
  Ringpop, Schemaless, and H3 exist because no existing tool met requirements.
- **Geo-spatial indexing is a first-class concern.** H3 converts the globe into
  hexagonal cells for efficient proximity queries.

---

## Cross-Architecture Comparison

### Technology Choices

```
+-------------+------------+------------+----------+----------+-----------+
| Component   | Discord    | Netflix    | Slack    | Instagram| Uber      |
+-------------+------------+------------+----------+----------+-----------+
| Language    | Elixir,Rust| Java,Python| Hack,Java| Python   | Go,Java   |
| API GW      | Custom     | Zuul       | Custom   | Django   | Custom    |
| Primary DB  | Cassandra  | Cassandra  | MySQL    | PgSQL    | Schemaless|
| Cache       | Redis      | EVCache    | Redis    | Memcached| Redis     |
| Queue/Stream| -          | Kafka      | Redis    | Celery   | Kafka     |
| Search      | -          | ES         | ES       | ES       | ES        |
| Shard Key   | guild_id   | N/A (AP)   |workspace | user_id  | city_id   |
+-------------+------------+------------+----------+----------+-----------+
```

### Common Patterns

| Pattern                          | Used By                              |
|----------------------------------|--------------------------------------|
| Shard by natural domain entity   | Discord, Slack, Instagram, Uber      |
| Cache-aside with dedicated layer | All five systems                     |
| Async job processing             | Slack, Instagram, Uber, Netflix      |
| Custom API gateway               | Discord, Netflix, Uber               |
| Polyglot persistence             | All five systems                     |
| Gradual language migration       | Discord (Go->Rust), Slack (PHP->Hack)|
| Chaos / resilience engineering   | Netflix (pioneered), Uber, Discord   |

---

## Anti-Patterns Observed

These mistakes were reported by engineering teams after production incidents.

| Anti-Pattern                        | Who Experienced It | Consequence               |
|-------------------------------------|--------------------|---------------------------|
| Distributed monolith                | Uber (early)       | Deployment coupling       |
| Shared database across services     | Slack (early)      | Schema migration locks    |
| Over-sharding too early             | Instagram          | Operational overhead      |
| Ignoring GC impact on tail latency  | Discord (Go)       | P99 spikes during GC      |
| Single region deployment            | Netflix (pre-2012) | Full outage on AWS failure|
| No circuit breakers between services| Uber (early)       | Cascading failures        |

---

## Validated Scalability Principles

These principles appear consistently across all five architectures.

| #  | Principle                          | Explanation                                       |
|----|------------------------------------|---------------------------------------------------|
| 1  | Shard by domain boundary           | Align the shard key with the natural isolation unit|
| 2  | Cache aggressively, invalidate well| Every system caches; correctness is the hard part  |
| 3  | Embrace async processing           | Queue everything that needs no synchronous response|
| 4  | Own your critical path             | Build custom only where off-the-shelf fails        |
| 5  | Evolve, do not rewrite             | Incremental migration beats big-bang rewrites      |
| 6  | Align teams with architecture      | Conway's Law is a force of nature — use it          |
| 7  | Instrument everything              | Metrics, traces, and structured logs from day one  |

---

## Key Takeaways

1. **There is no universal architecture.** Each system was shaped by its unique
   constraints: Discord optimizes for fan-out, Netflix for video delivery,
   Uber for geo-spatial matching.
2. **Monoliths can scale further than expected.** Instagram serves 2B users on
   Django. Optimize the monolith before decomposing it.
3. **Language choice matters at the extremes.** Discord's Go-to-Rust migration
   and Slack's PHP-to-Hack migration delivered measurable improvements.
4. **Sharding is inevitable at scale.** Every system shards by a domain-aligned key.
   Changing a shard key later is extremely costly.
5. **Custom infrastructure has a maintenance cost.** Build custom only when necessary.
6. **Resilience must be practiced, not assumed.** Adopt chaos engineering.
7. **Study architectures for principles, not prescriptions.** Extract the reasoning
   and apply it to your own constraints.
