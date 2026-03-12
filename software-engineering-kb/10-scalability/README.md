# 10 — Scalability

> Engineering systems that handle growth in users, data, and traffic without degrading performance or reliability.

## Structure (9 folders, 33 files)

### horizontal-scaling/ (4 files)
- [load-balancing.md](horizontal-scaling/load-balancing.md) — L4/L7 load balancers, algorithms, NGINX/HAProxy, GSLB, health checks
- [auto-scaling.md](horizontal-scaling/auto-scaling.md) — Reactive/predictive/scheduled scaling, HPA, KEDA, AWS ASG
- [stateless-services.md](horizontal-scaling/stateless-services.md) — Shared-nothing architecture, externalized state, 12-factor
- [session-management.md](horizontal-scaling/session-management.md) — Redis sessions, JWT, sticky sessions, session migration

### vertical-scaling/ (2 files)
- [when-to-scale-up.md](vertical-scaling/when-to-scale-up.md) — Decision framework, cost comparison, diagonal scaling strategy
- [hardware-optimization.md](vertical-scaling/hardware-optimization.md) — CPU/memory/storage/network scaling, NUMA, instance families

### database-scaling/ (5 files)
- [sharding.md](database-scaling/sharding.md) — Hash/range/geographic sharding, consistent hashing, shard key selection
- [partitioning.md](database-scaling/partitioning.md) — Range/list/hash partitioning, partition pruning, lifecycle management
- [read-replicas.md](database-scaling/read-replicas.md) — Replica topologies, replication lag, read/write splitting
- [newsql.md](database-scaling/newsql.md) — CockroachDB/TiDB/YugabyteDB/Spanner, distributed SQL trade-offs
- [cqrs-event-sourcing.md](database-scaling/cqrs-event-sourcing.md) — CQRS read/write separation, event sourcing, projections

### async-processing/ (4 files)
- [message-queues.md](async-processing/message-queues.md) — Queue-based decoupling, Kafka/RabbitMQ/NATS/SQS at scale
- [event-streaming.md](async-processing/event-streaming.md) — Kafka partitions, schema evolution, exactly-once semantics
- [batch-processing.md](async-processing/batch-processing.md) — MapReduce, Spark/Flink, job scheduling, checkpoint/resume
- [saga-pattern.md](async-processing/saga-pattern.md) — Choreography vs orchestration, compensation logic, idempotency

### patterns/ (6 files)
- [circuit-breaker.md](patterns/circuit-breaker.md) — State machine, sliding window, Istio config, cascading failure prevention
- [bulkhead.md](patterns/bulkhead.md) — Thread pool/semaphore isolation, K8s resource quotas, sizing
- [backpressure.md](patterns/backpressure.md) — Pull/push flow control, load shedding, reactive streams
- [graceful-degradation.md](patterns/graceful-degradation.md) — Degradation levels, feature flags, SLA-tier policies
- [retry-with-backoff.md](patterns/retry-with-backoff.md) — Exponential backoff, jitter, retry budgets, idempotency
- [cell-based-architecture.md](patterns/cell-based-architecture.md) — Cell isolation, consistent hash routing, cell evacuation

### cdn-and-edge/ (3 files)
- [cdn-fundamentals.md](cdn-and-edge/cdn-fundamentals.md) — Cache hierarchy, provider comparison, origin shield, invalidation
- [edge-functions.md](cdn-and-edge/edge-functions.md) — Cloudflare Workers, Lambda@Edge, edge auth, KV storage
- [global-distribution.md](cdn-and-edge/global-distribution.md) — Multi-region routing, Anycast, active-active, data sovereignty

### infrastructure/ (3 files)
- [container-orchestration.md](infrastructure/container-orchestration.md) — K8s HPA/VPA/KEDA, topology spread, resource quotas
- [serverless-scaling.md](infrastructure/serverless-scaling.md) — Lambda concurrency, cold starts, Step Functions, cost modeling
- [multi-region-deployment.md](infrastructure/multi-region-deployment.md) — Active-active/passive, Istio federation, failover strategies

### capacity-planning/ (3 files)
- [capacity-planning.md](capacity-planning/capacity-planning.md) — Measure/model/predict/provision methodology, traffic modeling
- [cost-optimization.md](capacity-planning/cost-optimization.md) — FinOps, reserved/spot instances, right-sizing, cost-per-request
- [monitoring-at-scale.md](capacity-planning/monitoring-at-scale.md) — Prometheus federation, SLO alerting, cardinality, RED method

### case-studies/ (3 files)
- [scaling-to-1m-users.md](case-studies/scaling-to-1m-users.md) — Progressive architecture from 0→1M with cost estimates
- [scaling-to-100m-users.md](case-studies/scaling-to-100m-users.md) — Global distribution, sharding, event-driven at 100M scale
- [real-world-architectures.md](case-studies/real-world-architectures.md) — Discord, Netflix, Slack, Instagram, Uber architectures

## Cross-References

| Topic | Primary Location | Scalability Perspective |
|-------|-----------------|----------------------|
| Microservices architecture | 03-architecture/architectural-patterns/microservices/ | Horizontal scaling patterns |
| Event-driven patterns | 03-architecture/architectural-patterns/event-driven/ | Async decoupling for scale |
| Message queues (Kafka, RabbitMQ) | 06-backend/message-queues/ | Partition scaling, consumer groups |
| Resilience patterns | 06-backend/health-resilience/ | Circuit breaker, bulkhead for scale |
| Database replication | 07-database/scaling/ | Read replica topology decisions |
| Sharding implementation | 07-database/scaling/sharding-partitioning.md | Shard key selection, resharding |
| Multi-region databases | 07-database/distributed-databases/ | Global data distribution |
| CDN caching | 09-performance/caching-strategies/cdn-caching.md | Cache hierarchy architecture |
| Edge computing | 09-performance/network-performance/edge-computing.md | Edge compute for scale |
| Load testing | 09-performance/benchmarking/ | Capacity validation |
