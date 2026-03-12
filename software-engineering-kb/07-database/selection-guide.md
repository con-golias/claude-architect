# Database Selection Guide

> **Domain:** Database > Selection Guide
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Choosing the wrong database is one of the most expensive mistakes a team can make. Migrating from one database to another mid-project costs months of engineering time and carries significant risk of data loss. The right database depends on data model, query patterns, scale requirements, consistency needs, and team expertise — not on hype or familiarity. This guide provides a structured decision framework for selecting databases across all major paradigms: relational, document, key-value, wide-column, graph, time-series, vector, search, and NewSQL.

---

## How It Works

### Database Paradigms Overview

```
Database Categories:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  RELATIONAL (SQL)                                         │
│  ├── PostgreSQL — General purpose, extensible, ACID      │
│  ├── MySQL      — Web applications, read-heavy           │
│  ├── SQLite     — Embedded, single-file, edge            │
│  └── SQL Server — Enterprise .NET ecosystems             │
│                                                            │
│  DOCUMENT                                                  │
│  ├── MongoDB    — Flexible schemas, JSON-native          │
│  ├── DynamoDB   — AWS serverless, key-value + document   │
│  └── Firestore  — Firebase/GCP, real-time sync           │
│                                                            │
│  KEY-VALUE                                                 │
│  ├── Redis      — In-memory, caching, pub/sub            │
│  ├── Memcached  — Simple caching                         │
│  ├── DynamoDB   — Persistent key-value at scale          │
│  └── etcd       — Distributed config, service discovery  │
│                                                            │
│  WIDE-COLUMN                                               │
│  ├── Cassandra  — Write-heavy, high availability         │
│  ├── ScyllaDB   — Cassandra-compatible, C++ performance  │
│  └── HBase      — Hadoop ecosystem, analytics            │
│                                                            │
│  GRAPH                                                     │
│  ├── Neo4j      — Cypher query language, ACID            │
│  ├── Amazon Neptune — Managed graph, Gremlin/SPARQL      │
│  └── Dgraph     — Distributed graph, GraphQL-native      │
│                                                            │
│  TIME-SERIES                                               │
│  ├── TimescaleDB — PostgreSQL extension                   │
│  ├── InfluxDB   — Purpose-built, InfluxQL/Flux           │
│  ├── Prometheus  — Metrics, pull-based collection         │
│  └── ClickHouse — Column-oriented analytics              │
│                                                            │
│  VECTOR                                                    │
│  ├── pgvector   — PostgreSQL extension                    │
│  ├── Pinecone   — Managed, serverless                    │
│  ├── Qdrant     — Open-source, Rust                      │
│  └── Weaviate   — Hybrid search, auto-vectorization      │
│                                                            │
│  SEARCH                                                    │
│  ├── Elasticsearch — Full-text, analytics                │
│  ├── OpenSearch — Elasticsearch fork, AWS                 │
│  ├── Meilisearch — Lightweight, typo-tolerant            │
│  └── Typesense — Lightweight, easy to operate            │
│                                                            │
│  NEWSQL (Distributed SQL)                                 │
│  ├── CockroachDB — PostgreSQL-compatible, Raft           │
│  ├── TiDB        — MySQL-compatible, distributed         │
│  ├── YugabyteDB  — PostgreSQL-compatible, multi-region   │
│  └── Spanner     — Google, global consistency            │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Master Decision Tree

```
Database Selection Decision Tree:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  What is your PRIMARY data access pattern?                │
│                                                            │
│  ┌─ Structured data with relationships (JOINs)?         │
│  │  └─ Need global distribution + SQL?                   │
│  │     ├─ YES → NewSQL (CockroachDB, YugabyteDB, TiDB) │
│  │     └─ NO → Relational (PostgreSQL, MySQL)            │
│  │         ├─ General purpose → PostgreSQL               │
│  │         ├─ Read-heavy web app → MySQL                 │
│  │         └─ Embedded / edge → SQLite                   │
│  │                                                        │
│  ┌─ Flexible/nested documents (no fixed schema)?        │
│  │  └─ MongoDB, DynamoDB, Firestore                     │
│  │     ├─ AWS serverless → DynamoDB                     │
│  │     ├─ Firebase ecosystem → Firestore                │
│  │     └─ General document store → MongoDB              │
│  │                                                        │
│  ┌─ Simple key → value lookups?                         │
│  │  └─ In-memory cache? → Redis / Memcached             │
│  │  └─ Persistent at scale? → DynamoDB                  │
│  │  └─ Config / service discovery? → etcd / Consul      │
│  │                                                        │
│  ┌─ Relationships ARE the data (graph traversal)?       │
│  │  └─ Neo4j, Amazon Neptune, Dgraph                    │
│  │                                                        │
│  ┌─ Time-series metrics / events?                       │
│  │  └─ Already using PostgreSQL? → TimescaleDB           │
│  │  └─ Infrastructure metrics? → Prometheus              │
│  │  └─ IoT / high cardinality? → InfluxDB               │
│  │  └─ Analytics / OLAP? → ClickHouse                   │
│  │                                                        │
│  ┌─ Full-text search?                                   │
│  │  └─ Simple search needs? → PostgreSQL GIN/GiST       │
│  │  └─ Advanced search + analytics? → Elasticsearch      │
│  │  └─ Lightweight / easy? → Meilisearch, Typesense     │
│  │                                                        │
│  ┌─ Vector similarity (AI/ML embeddings)?               │
│  │  └─ Already using PostgreSQL? → pgvector              │
│  │  └─ Managed / serverless? → Pinecone                 │
│  │  └─ Self-hosted? → Qdrant, Weaviate                  │
│  │                                                        │
│  ┌─ Write-heavy, eventually consistent at massive scale?│
│  │  └─ Cassandra, ScyllaDB                              │
│  │                                                        │
│  ┌─ Unsure / multiple needs?                            │
│  │  └─ Start with PostgreSQL (handles 90% of use cases) │
│  │     Add specialized databases as needs emerge        │
│  │                                                        │
└──────────────────────────────────────────────────────────┘
```

### Comprehensive Comparison Matrix

```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Dimension    │PostgreSQL│ MySQL    │ MongoDB  │ Redis    │ Cassandra│
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Model        │Relational│Relational│Document  │Key-Value │Wide-Col  │
│ Schema       │Strict    │Strict    │Flexible  │Schemaless│Flexible  │
│ Query Lang   │SQL       │SQL       │MQL       │Commands  │CQL       │
│ ACID         │Full      │Full      │Document  │Per-cmd   │Tunable   │
│ JOINs        │Excellent │Good      │$lookup   │None      │None      │
│ Scaling      │Vertical* │Vertical* │Horizontal│Cluster   │Horizontal│
│ Replication  │Streaming │GTID      │Replica Set│Cluster  │Multi-DC  │
│ Consistency  │Strong    │Strong    │Tunable   │Strong*   │Tunable   │
│ Write Speed  │Good      │Good      │Fast      │Very Fast │Very Fast │
│ Read Speed   │Fast      │Fast      │Fast      │Ultra Fast│Fast      │
│ Full-Text    │Built-in  │Built-in  │Built-in  │RediSearch│Solr int. │
│ JSON Support │JSONB     │JSON      │Native    │JSON mod  │Limited   │
│ Geospatial   │PostGIS   │Built-in  │Built-in  │Geo cmds  │Limited   │
│ Max Data     │Petabytes │Petabytes │Petabytes │~100GB/node│Petabytes │
│ License      │PostgreSQL│GPL/Comm  │SSPL      │BSD/Comm  │Apache    │
│ Cloud Managed│RDS,Cloud │RDS,Cloud │Atlas     │ElastiC.  │Astra     │
│ Best For     │General   │Web apps  │Flexible  │Caching   │IoT/Write │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

* PostgreSQL/MySQL: horizontal with Citus/Vitess or NewSQL alternatives
* Redis: strong consistency within single node, eventual with cluster
```

```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Dimension    │Cockroach │ Neo4j    │ Elastic- │ Timescale│ Pinecone │
│              │ DB       │          │ search   │ DB       │          │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Model        │Relational│Graph     │Search    │Time-Ser. │Vector    │
│ Schema       │Strict    │Flexible  │Dynamic   │Strict    │Flexible  │
│ Query Lang   │SQL(PG)   │Cypher    │Query DSL │SQL       │REST API  │
│ ACID         │Full      │Full      │Eventual  │Full      │Eventual  │
│ JOINs        │Full SQL  │Traversal │Limited   │Full SQL  │None      │
│ Scaling      │Horizontal│Cluster   │Horizontal│PG-based  │Serverless│
│ Replication  │Raft      │Causal Cl.│Built-in  │PG Stream │Managed   │
│ Consistency  │Serializ. │Causal    │Eventual  │Strong    │Eventual  │
│ Write Speed  │Good      │Moderate  │Fast      │Very Fast │Fast      │
│ Read Speed   │Good      │Fast*     │Very Fast │Fast      │Very Fast │
│ Best For     │Global SQL│Graph data│Search    │Metrics   │AI/ML     │
│ Complexity   │Medium    │Medium    │High      │Low (PG)  │Low       │
│ Cost         │High      │High      │High      │Moderate  │Pay/use   │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

* Neo4j: fast for graph traversals, slow for full scans
```

### Use Case → Database Mapping

```
Common Use Cases and Recommended Databases:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  SaaS Application (multi-tenant CRUD)                     │
│  → PostgreSQL + Redis (cache)                             │
│  Why: ACID, JSON support, RLS for multi-tenancy          │
│                                                            │
│  E-Commerce Platform                                      │
│  → PostgreSQL (orders, users) + Elasticsearch (search)   │
│  → + Redis (sessions, cart cache)                        │
│  Why: ACID for transactions, full-text for catalog       │
│                                                            │
│  Social Network                                           │
│  → PostgreSQL (users, posts) + Neo4j (social graph)      │
│  → + Redis (feed cache) + Elasticsearch (search)        │
│  Why: Graph queries for connections, SQL for CRUD        │
│                                                            │
│  Real-Time Analytics Dashboard                            │
│  → ClickHouse or TimescaleDB (metrics)                   │
│  → + PostgreSQL (config) + Redis (real-time counters)    │
│  Why: Column-oriented for aggregation queries             │
│                                                            │
│  IoT Platform (millions of devices)                       │
│  → TimescaleDB or InfluxDB (sensor data)                 │
│  → + Cassandra (high write throughput)                   │
│  → + Redis (device state cache)                          │
│  Why: Time-series optimized storage and queries           │
│                                                            │
│  AI / RAG Application                                     │
│  → PostgreSQL + pgvector (embeddings + relational data)  │
│  → OR Pinecone/Qdrant (dedicated vector DB) + PostgreSQL │
│  Why: Combine vector similarity with relational context  │
│                                                            │
│  Content Management System                                │
│  → PostgreSQL (structured) OR MongoDB (flexible schema)  │
│  → + Elasticsearch (full-text search)                    │
│  Why: CMS content varies in structure                    │
│                                                            │
│  Gaming Leaderboard / Session Store                       │
│  → Redis (sorted sets for leaderboards)                  │
│  → + PostgreSQL (user accounts, purchases)               │
│  Why: Sub-millisecond reads for real-time ranking        │
│                                                            │
│  Global Financial System                                  │
│  → CockroachDB or Google Spanner                         │
│  Why: Serializable isolation + global distribution       │
│                                                            │
│  Microservices (polyglot persistence)                     │
│  → Service-specific databases:                           │
│     User service: PostgreSQL                             │
│     Product catalog: MongoDB or PostgreSQL               │
│     Search: Elasticsearch                                │
│     Cache: Redis                                         │
│     Analytics: ClickHouse                                │
│  Why: Each service uses the best tool for its workload   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### PostgreSQL as Default Choice

```
Why PostgreSQL Should Be Your Default:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  PostgreSQL handles 90% of application needs:             │
│                                                            │
│  ✅ Relational data     — Full SQL, JOINs, constraints   │
│  ✅ JSON/document data  — JSONB with indexing             │
│  ✅ Full-text search    — tsvector, ts_rank, GIN index    │
│  ✅ Vector search       — pgvector extension               │
│  ✅ Time-series data    — TimescaleDB extension            │
│  ✅ Geospatial data     — PostGIS extension                │
│  ✅ Key-value patterns  — hstore or JSONB                 │
│  ✅ Graph queries       — Recursive CTEs, Apache AGE      │
│  ✅ Pub/Sub             — LISTEN/NOTIFY                   │
│  ✅ Job queues          — SKIP LOCKED (Graphile Worker)   │
│  ✅ Multi-tenancy       — Row-Level Security (RLS)        │
│                                                            │
│  Only add specialized databases when PostgreSQL            │
│  becomes the bottleneck for a specific workload:          │
│                                                            │
│  🔄 Search > 10M docs with complex queries → Elasticsearch│
│  🔄 Cache with sub-ms latency → Redis                    │
│  🔄 Billions of time-series points → ClickHouse          │
│  🔄 Billions of vectors → Pinecone/Qdrant                │
│  🔄 Heavy graph traversals → Neo4j                       │
│  🔄 Global distribution with SQL → CockroachDB           │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Managed vs Self-Hosted Decision

```
Managed Database Services vs Self-Hosted:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  USE MANAGED when:                                        │
│  ✅ Team < 5 engineers (no dedicated DBA)                │
│  ✅ Startup / early-stage (focus on product)             │
│  ✅ Compliance requirements (SOC2, HIPAA)                │
│  ✅ Multi-region requirements                             │
│  ✅ Automated backups and failover critical               │
│                                                            │
│  Managed options:                                         │
│  ├── AWS RDS / Aurora (PostgreSQL, MySQL)                │
│  ├── Google Cloud SQL / AlloyDB                          │
│  ├── Azure Database for PostgreSQL / MySQL               │
│  ├── PlanetScale (MySQL, serverless)                     │
│  ├── Neon (PostgreSQL, serverless)                       │
│  ├── Supabase (PostgreSQL + auth + storage)              │
│  └── MongoDB Atlas (MongoDB, serverless tier)            │
│                                                            │
│  USE SELF-HOSTED when:                                    │
│  ✅ Have dedicated database team                          │
│  ✅ Extreme performance requirements                     │
│  ✅ Data sovereignty / air-gapped environment            │
│  ✅ Cost optimization at very large scale                │
│  ✅ Need custom PostgreSQL extensions                     │
│  ✅ Need precise control over configuration              │
│                                                            │
│  Self-hosted helpers:                                     │
│  ├── Patroni (PostgreSQL HA)                             │
│  ├── Citus (PostgreSQL sharding)                         │
│  ├── Vitess (MySQL sharding)                             │
│  └── Kubernetes operators (CloudNativePG, Percona)       │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Multi-Database Architecture Patterns

```
Polyglot Persistence Pattern:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Pattern 1: Primary + Cache                               │
│  PostgreSQL (source of truth) + Redis (read cache)       │
│  → Most common pattern, fits 80% of applications        │
│                                                            │
│  Pattern 2: Primary + Search                              │
│  PostgreSQL (CRUD) + Elasticsearch (search/analytics)    │
│  → Sync via Change Data Capture (Debezium)               │
│                                                            │
│  Pattern 3: OLTP + OLAP                                  │
│  PostgreSQL (transactions) + ClickHouse (analytics)      │
│  → Replicate via logical replication or ETL              │
│                                                            │
│  Pattern 4: Microservices Polyglot                        │
│  Each service owns its database:                         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │Service1│ │Service2│ │Service3│ │Service4│           │
│  │  (PG)  │ │(Mongo) │ │(Redis) │ │ (ES)   │           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
│  → Data sync via events (Kafka, message queues)          │
│                                                            │
│  Anti-Pattern: Shared database across services           │
│  → Tight coupling, schema change coordination nightmare  │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Cost Considerations

```
Cost Comparison (approximate monthly costs at moderate scale):
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  Database          │ Self-Hosted* │ Managed (AWS)         │
│  ──────────────────┼──────────────┼────────────────────── │
│  PostgreSQL        │ $200-500     │ $300-1,500 (RDS)     │
│  MySQL             │ $200-500     │ $300-1,500 (RDS)     │
│  MongoDB           │ $200-500     │ $500-2,000 (Atlas)   │
│  Redis             │ $100-300     │ $200-1,000 (ElastiC) │
│  Elasticsearch     │ $500-2,000   │ $1,000-5,000 (OSS)   │
│  CockroachDB       │ $1,000+      │ $2,000+ (Dedicated)  │
│  Neo4j             │ $500-1,000   │ $1,500+ (AuraDB)     │
│  ClickHouse        │ $300-1,000   │ $500-2,000 (Cloud)   │
│  Pinecone          │ N/A          │ $70-800+ (Serverless) │
│                                                            │
│  * Self-hosted: includes EC2/compute cost + ops time     │
│  Rule: Managed is 2-3x more expensive but saves          │
│  1-2 engineer-weeks per month in operations              │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Team Expertise Factor

```
Team Expertise Consideration:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  KNOWN EXPERTISE → Use what you know                     │
│                                                            │
│  Team knows MySQL well but problem fits PostgreSQL?      │
│  → Use MySQL (unless PostgreSQL features are critical)   │
│  → Operational expertise > marginal technical advantage  │
│                                                            │
│  EXCEPTIONS (where specific DB matters):                  │
│  - Need JSONB with GIN indexing → PostgreSQL             │
│  - Need global serializable transactions → CockroachDB  │
│  - Need graph traversals on connected data → Neo4j      │
│  - Need sub-ms reads at millions QPS → Redis             │
│  - Need billion-row analytics → ClickHouse               │
│                                                            │
│  LEARNING BUDGET:                                         │
│  If the team has capacity to learn:                      │
│  - PostgreSQL: 1-2 weeks for SQL developers              │
│  - MongoDB: 1-2 weeks for any developer                  │
│  - Redis: 1 week for basic usage                         │
│  - Elasticsearch: 2-4 weeks for production readiness     │
│  - CockroachDB: 1 week for PostgreSQL developers         │
│  - Cassandra: 4-8 weeks (different paradigm)             │
│  - Neo4j: 2-4 weeks (graph thinking)                     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS start with PostgreSQL** unless specific requirements disqualify it
2. **ALWAYS choose based on data access patterns** — not popularity or hype
3. **ALWAYS consider operational complexity** — a database you can't operate is useless
4. **ALWAYS use managed databases** for teams without dedicated DBAs
5. **ALWAYS plan for polyglot persistence** — most production systems use 2-3 databases
6. **ALWAYS evaluate team expertise** — operational familiarity outweighs marginal features
7. **NEVER choose a database you can't monitor and backup** — operability is non-negotiable
8. **NEVER use a specialized database as your primary** — PostgreSQL/MySQL as foundation
9. **NEVER share databases across microservices** — each service owns its data store
10. **NEVER choose based on benchmarks alone** — real workloads differ from synthetic tests

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| MongoDB for everything | Missing JOINs, data duplication | Use relational DB for structured data |
| Relational DB for graph data | Recursive CTEs, slow traversals | Use Neo4j for relationship-heavy queries |
| Redis as primary database | Data loss on restart | Redis = cache, PostgreSQL = source of truth |
| Elasticsearch as primary DB | Data inconsistency, no ACID | ES = search index, not primary store |
| Choosing based on hype | Operational pain, team confusion | Choose based on access patterns + team skills |
| Shared database across services | Tight coupling, migration nightmare | Database-per-service pattern |
| Premature specialized DB | Operational overhead for small gains | Start with PostgreSQL, specialize when needed |
| Self-hosting without DBA | Unoptimized, unmonitored, risky | Use managed service or hire DBA |
| No data access pattern analysis | Wrong database for workload | Document read/write patterns before choosing |
| Ignoring total cost of ownership | Budget overruns | Include ops time in cost calculation |

---

## Enforcement Checklist

- [ ] Data access patterns documented before database selection
- [ ] Database selected based on decision tree, not familiarity alone
- [ ] PostgreSQL considered as default (must justify alternatives)
- [ ] Managed vs self-hosted decision made explicitly
- [ ] Team expertise assessed and training planned if needed
- [ ] Multi-database architecture planned (primary + cache + search)
- [ ] Operational requirements evaluated (backup, monitoring, failover)
- [ ] Cost analysis includes both infrastructure AND operations time
- [ ] Migration path identified if initial choice proves wrong
- [ ] Database-per-service pattern enforced in microservices
