# Database Types & Data Models

> **Domain:** Database > Fundamentals
> **Difficulty:** Beginner
> **Last Updated:** —

## Why It Matters

Choosing the wrong database type is one of the most expensive architectural mistakes. Each database type optimizes for different access patterns, consistency requirements, and scaling characteristics. A relational database forced into a graph traversal workload will crawl. A document store forced into heavy joins will collapse. Understanding the fundamental data models — relational, document, key-value, wide-column, graph, time-series, vector, and search — lets you match the database to the workload, not the other way around.

---

## How It Works

### The Database Landscape

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE TYPES                                  │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ RELATIONAL  │  │  DOCUMENT   │  │  KEY-VALUE  │                 │
│  │ PostgreSQL  │  │  MongoDB    │  │  Redis      │                 │
│  │ MySQL       │  │  Firestore  │  │  DynamoDB   │                 │
│  │ SQLite      │  │  CouchDB    │  │  Memcached  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ WIDE-COLUMN │  │   GRAPH     │  │ TIME-SERIES │                 │
│  │ Cassandra   │  │  Neo4j      │  │ TimescaleDB │                 │
│  │ ScyllaDB    │  │  Neptune    │  │ InfluxDB    │                 │
│  │ HBase       │  │  ArangoDB   │  │ QuestDB     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐                                   │
│  │   VECTOR    │  │   SEARCH    │                                   │
│  │ pgvector    │  │Elasticsearch│                                   │
│  │ Pinecone    │  │ Meilisearch │                                   │
│  │ Weaviate    │  │ Typesense   │                                   │
│  └─────────────┘  └─────────────┘                                   │
│                                                                      │
│  ┌─────────────────────────────────────────┐                        │
│  │       DISTRIBUTED SQL (NewSQL)          │                        │
│  │  CockroachDB · YugabyteDB · TiDB       │                        │
│  │  Google Spanner · PlanetScale           │                        │
│  └─────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 1. Relational Databases (RDBMS)

**Data Model:** Tables with rows and columns, strict schema, relationships via foreign keys.

```
┌──────────────────────┐       ┌──────────────────────┐
│       users          │       │       orders          │
├──────────────────────┤       ├──────────────────────┤
│ id (PK)              │──┐    │ id (PK)              │
│ name                 │  │    │ user_id (FK) ────────│──┐
│ email (UNIQUE)       │  └───►│ total                │  │
│ created_at           │       │ status               │  │
└──────────────────────┘       └──────────────────────┘  │
                                         │               │
                               ┌─────────┘               │
                               ▼                         │
                       ┌──────────────────────┐          │
                       │    order_items        │          │
                       ├──────────────────────┤          │
                       │ order_id (FK) ───────│──────────┘
                       │ product_id (FK)      │
                       │ quantity             │
                       │ price                │
                       └──────────────────────┘
```

**Key Characteristics:**
- ACID transactions (Atomicity, Consistency, Isolation, Durability)
- SQL query language — declarative, standardized since 1986
- Schema-on-write — structure enforced at insert time
- Normalization reduces data duplication
- JOINs combine data across tables efficiently
- Strong consistency by default

**When to Use:**
- Complex queries with JOINs across multiple entities
- Transactions that must be atomic (financial, inventory, booking)
- Data integrity is non-negotiable (foreign keys, constraints, CHECK)
- Structured data with clear relationships
- Reporting and analytics with aggregations

**Major Databases:**

| Database | Best For | Max Scale | License |
|----------|----------|-----------|---------|
| **PostgreSQL** | General purpose, advanced features | Vertical + read replicas | Open source (PostgreSQL License) |
| **MySQL** | Web applications, read-heavy | Master-replica | Open source (GPL) |
| **SQLite** | Embedded, mobile, testing, edge | Single-file, no server | Public domain |
| **SQL Server** | Enterprise, .NET ecosystem | Enterprise clustering | Commercial |
| **Oracle** | Enterprise, legacy systems | RAC clustering | Commercial |

---

### 2. Document Databases

**Data Model:** JSON/BSON documents with flexible schema, nested objects and arrays.

```json
// MongoDB document — no fixed schema, nested data
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "addresses": [
    {
      "type": "home",
      "street": "123 Main St",
      "city": "Portland",
      "state": "OR"
    },
    {
      "type": "work",
      "street": "456 Corp Ave",
      "city": "Seattle",
      "state": "WA"
    }
  ],
  "orders": [
    {
      "id": "ord-001",
      "total": 149.99,
      "items": [
        { "product": "Widget", "qty": 3, "price": 49.99 }
      ]
    }
  ]
}
```

**Key Characteristics:**
- Schema-flexible — each document can have different fields
- Documents are self-contained (denormalized by default)
- No JOINs needed for typical access patterns
- Horizontal scaling through sharding (built-in)
- Rich query language with aggregation pipelines
- Schema-on-read — structure interpreted at query time

**When to Use:**
- Rapidly evolving schemas (startups, prototyping, MVPs)
- Data naturally forms hierarchical documents (content management, user profiles)
- Each entity is read/written as a unit (no multi-table JOINs)
- Catalog data with varying attributes per item (e-commerce products)
- Need horizontal scaling with automatic sharding

**When NOT to Use:**
- Heavy cross-document JOINs required
- Strong referential integrity needed
- Complex transactions across multiple documents
- Highly relational data (many-to-many relationships)

---

### 3. Key-Value Stores

**Data Model:** Simple key → value pairs. Value is opaque to the database.

```
┌─────────────────────────────────────────────┐
│              KEY-VALUE STORE                  │
│                                              │
│  Key                    Value                │
│  ─────────────────────  ──────────────────── │
│  "user:1001"            { serialized JSON }  │
│  "session:abc123"       { session data }     │
│  "cache:product:42"     { product JSON }     │
│  "rate:192.168.1.1"     "47"                 │
│  "lock:order:5001"      "owner-node-3"       │
└─────────────────────────────────────────────┘
```

**Key Characteristics:**
- Simplest data model — get(key), set(key, value), delete(key)
- Extremely fast — O(1) lookups, sub-millisecond latency
- Value can be string, JSON, binary blob — database does not interpret it
- Horizontal scaling by key partitioning
- Often in-memory for maximum performance
- TTL (time-to-live) support for automatic expiration

**When to Use:**
- Caching (session data, API responses, computed results)
- Rate limiting and counters
- Distributed locks
- Feature flags and configuration
- Shopping carts, real-time leaderboards
- Any pattern where access is always by primary key

**Major Databases:**

| Database | Type | Persistence | Special Features |
|----------|------|-------------|-----------------|
| **Redis** | In-memory + disk | RDB/AOF | Data structures (lists, sets, sorted sets, streams) |
| **DynamoDB** | Managed cloud | Fully durable | Auto-scaling, global tables, streams |
| **Memcached** | In-memory only | None | Multi-threaded, simple protocol |
| **etcd** | Distributed | Raft consensus | Service discovery, distributed config |

---

### 4. Wide-Column Stores

**Data Model:** Tables with rows and dynamic columns. Each row can have different columns.

```
┌────────────────────────────────────────────────────────────────┐
│  Row Key          │ Column Family: profile   │ CF: metrics     │
├────────────────────────────────────────────────────────────────┤
│ user:1001         │ name="Alice"             │ logins=142      │
│                   │ email="alice@ex.com"     │ last_seen=...   │
│                   │ plan="premium"           │                 │
├────────────────────────────────────────────────────────────────┤
│ user:1002         │ name="Bob"               │ logins=7        │
│                   │ country="DE"             │ last_seen=...   │
│                   │                          │ page_views=523  │
└────────────────────────────────────────────────────────────────┘

Each row can have DIFFERENT columns — no fixed schema per column family.
```

**Key Characteristics:**
- Designed for massive write throughput (millions of writes/sec)
- Distributed across many nodes with automatic partitioning
- Tunable consistency (ALL, QUORUM, ONE)
- No JOINs, no subqueries — denormalized by design
- Data modeled around query patterns, not entity relationships
- Time-series friendly with sorted columns

**When to Use:**
- IoT data ingestion at massive scale (billions of rows)
- Time-series data with high write throughput
- Logging and event tracking systems
- Geographic distribution across data centers
- Data that is write-heavy with simple read patterns

---

### 5. Graph Databases

**Data Model:** Nodes (entities) and edges (relationships) with properties on both.

```
┌─────────┐    FOLLOWS     ┌─────────┐
│  Alice   │──────────────►│   Bob   │
│ (User)   │               │ (User)  │
└────┬─────┘               └────┬────┘
     │                          │
     │ PURCHASED                │ REVIEWED
     │                          │
     ▼                          ▼
┌─────────┐    SIMILAR_TO   ┌─────────┐
│ Widget A │◄──────────────│ Widget B │
│(Product) │               │(Product) │
└──────────┘               └─────────┘
```

**Key Characteristics:**
- Relationships are first-class citizens (stored, not computed)
- Traversals across relationships are O(1) per hop — no JOINs
- Index-free adjacency — each node points directly to neighbors
- Pattern matching queries (Cypher, Gremlin, SPARQL)
- Ideal for finding paths, clusters, and communities

**When to Use:**
- Social networks (friends-of-friends, mutual connections)
- Recommendation engines ("users who bought X also bought Y")
- Fraud detection (circular transactions, suspicious patterns)
- Knowledge graphs and ontologies
- Network topology (infrastructure, dependencies)
- Access control (role → permission → resource traversal)

---

### 6. Time-Series Databases

**Data Model:** Timestamped data points, optimized for append-only writes and range queries.

```
┌──────────────────────────────────────────────────────┐
│  time                   │ metric    │ host    │ value │
├──────────────────────────────────────────────────────┤
│ 2025-01-15T10:00:00Z    │ cpu_usage │ web-01  │ 72.5  │
│ 2025-01-15T10:00:00Z    │ cpu_usage │ web-02  │ 45.2  │
│ 2025-01-15T10:00:05Z    │ cpu_usage │ web-01  │ 73.1  │
│ 2025-01-15T10:00:05Z    │ cpu_usage │ web-02  │ 44.8  │
│ 2025-01-15T10:00:10Z    │ cpu_usage │ web-01  │ 71.9  │
└──────────────────────────────────────────────────────┘
 Optimized for: INSERT (append), SELECT WHERE time BETWEEN x AND y
 NOT optimized for: UPDATE, DELETE, JOIN
```

**Key Characteristics:**
- Append-only writes (immutable time-series data)
- Aggressive compression (10x-100x vs generic databases)
- Automatic data retention and downsampling
- Built-in aggregation functions (avg, min, max, percentile over time windows)
- Optimized for range queries on time dimension

**When to Use:**
- Application and infrastructure monitoring (Prometheus, Grafana)
- IoT sensor data collection
- Financial market data (tick data, OHLCV)
- Real-time analytics dashboards
- Log aggregation and event tracking

---

### 7. Vector Databases

**Data Model:** High-dimensional vectors (embeddings) with similarity search.

```
┌───────────────────────────────────────────────────┐
│  id    │ embedding [1536 dims]     │ metadata     │
├───────────────────────────────────────────────────┤
│ doc-1  │ [0.023, -0.15, 0.87, ...]│ {type:"pdf"} │
│ doc-2  │ [0.045, -0.12, 0.91, ...]│ {type:"web"} │
│ doc-3  │ [-0.11, 0.33, 0.02, ...] │ {type:"pdf"} │
└───────────────────────────────────────────────────┘

Query: "Find 5 most similar documents to this embedding"
→ Uses ANN (Approximate Nearest Neighbor) algorithms
→ Returns doc-2 (0.95), doc-1 (0.89), doc-3 (0.34), ...
```

**Key Characteristics:**
- Store and index high-dimensional vectors (embeddings from ML models)
- Similarity search using cosine, euclidean, or dot product distance
- ANN algorithms (HNSW, IVF, PQ) for sub-linear search time
- Metadata filtering combined with vector search (hybrid search)
- Essential for AI/ML applications (RAG, semantic search, recommendations)

**When to Use:**
- Retrieval-Augmented Generation (RAG) for LLMs
- Semantic search (search by meaning, not keywords)
- Image/audio/video similarity search
- Recommendation systems
- Anomaly detection in high-dimensional data

---

### 8. Search Engines

**Data Model:** Inverted index for full-text search with relevance scoring.

**Key Characteristics:**
- Inverted index maps terms → documents (opposite of forward index)
- Relevance scoring (BM25, TF-IDF)
- Analyzers: tokenization, stemming, stop words, synonyms
- Faceted search and aggregations
- Near real-time indexing

**When to Use:**
- Full-text search with relevance ranking
- Autocomplete and suggestions
- Log analysis and observability (ELK stack)
- E-commerce product search with filters and facets
- Content discovery platforms

> **Cross-reference:** For search implementation details → `06-backend/search/elasticsearch.md`

---

## Master Comparison Matrix

| Feature | Relational | Document | Key-Value | Wide-Column | Graph | Time-Series | Vector |
|---------|:----------:|:--------:|:---------:|:-----------:|:-----:|:-----------:|:------:|
| **Schema** | Fixed | Flexible | None | Flexible columns | Flexible | Fixed | Fixed + vectors |
| **Query Language** | SQL | Custom (MQL) | get/set | CQL | Cypher/Gremlin | SQL/Flux | Custom |
| **JOINs** | Native | Limited ($lookup) | None | None | Traversals | Limited | None |
| **Transactions** | Full ACID | Single-doc ACID | Varies | Tunable | Varies | Limited | None |
| **Scaling** | Vertical + replicas | Horizontal (sharding) | Horizontal | Horizontal | Vertical | Horizontal | Horizontal |
| **Write Speed** | Medium | High | Very High | Very High | Medium | Very High | Medium |
| **Read Pattern** | Any query | By document | By key only | By partition key | By traversal | By time range | By similarity |
| **Consistency** | Strong | Tunable | Varies | Tunable | Strong | Eventual | Eventual |
| **Best For** | Transactions, reports | Content, catalogs | Cache, sessions | IoT, logs | Relationships | Metrics, sensors | AI/ML, search |

---

## SQL vs NoSQL Decision

```
                    ┌─────────────────────────────┐
                    │   What are your requirements? │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Need ACID transactions       │
                    │  across multiple entities?     │
                    └──────────────┬───────────────┘
                          YES │         │ NO
                              │         │
                    ┌─────────▼──┐  ┌──▼──────────────────┐
                    │ RELATIONAL │  │ What's the primary   │
                    │ PostgreSQL │  │ access pattern?       │
                    │ MySQL      │  └──────────┬───────────┘
                    └────────────┘             │
                         ┌────────────────────┼──────────────────┐
                         │                    │                  │
                  ┌──────▼──────┐  ┌─────────▼──────┐  ┌──────▼──────┐
                  │ By key/ID   │  │ By document    │  │ By time     │
                  │ → KEY-VALUE │  │ → DOCUMENT     │  │ → TIME-SERIES│
                  │ Redis       │  │ MongoDB        │  │ TimescaleDB │
                  │ DynamoDB    │  │ Firestore      │  │ InfluxDB    │
                  └─────────────┘  └────────────────┘  └─────────────┘
                         │
                  ┌──────▼──────┐  ┌────────────────┐  ┌─────────────┐
                  │Relationships│  │ Massive writes  │  │ AI/ML       │
                  │ → GRAPH     │  │ → WIDE-COLUMN  │  │ → VECTOR    │
                  │ Neo4j       │  │ Cassandra      │  │ pgvector    │
                  └─────────────┘  └────────────────┘  └─────────────┘
```

---

## Multi-Model & Polyglot Persistence

Modern applications often use multiple database types together:

```
┌──────────────────────────────────────────────────────────┐
│                    APPLICATION                            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Users &  │  │ Product  │  │ Sessions │  │ Search  │ │
│  │ Orders   │  │ Catalog  │  │ & Cache  │  │ Index   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
└───────┼──────────────┼──────────────┼──────────────┼─────┘
        │              │              │              │
   ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌────▼────┐
   │PostgreSQL│  │ MongoDB  │  │  Redis   │  │  Elastic │
   │ (ACID)   │  │ (Flex)   │  │ (Fast)   │  │ (Search) │
   └──────────┘  └──────────┘  └──────────┘  └─────────┘
```

**Rules for Polyglot Persistence:**
1. ALWAYS use the simplest database that meets your requirements
2. ALWAYS start with ONE database — add others only when needed
3. NEVER use a database just because it is trendy
4. ALWAYS consider operational complexity — each database is another system to maintain
5. ALWAYS keep a single source of truth — sync other databases via CDC or events

---

## Best Practices

1. **ALWAYS choose database based on access patterns** — not brand or popularity
2. **ALWAYS start with PostgreSQL** if you are unsure — it covers 80% of use cases
3. **ALWAYS prototype with your actual data** before committing to a database
4. **ALWAYS consider operational cost** — managed services reduce burden
5. **NEVER choose NoSQL just to avoid learning SQL** — SQL is a fundamental skill
6. **NEVER use multiple databases without a clear reason** — complexity compounds
7. **ALWAYS benchmark with realistic data volumes** — toy benchmarks mislead
8. **ALWAYS plan for data migration** — you may need to switch databases later

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using MongoDB for everything | Complex aggregation pipelines replacing JOINs | Use PostgreSQL for relational data |
| Relational DB for key-value access | Simple lookups going through SQL parser | Use Redis or DynamoDB for hot-path lookups |
| Graph queries in relational DB | Recursive CTEs with 10+ levels, slow | Use Neo4j for deep relationship traversals |
| Wide-column DB for small datasets | Operational overhead without scale benefits | Use PostgreSQL until you outgrow it |
| Choosing DB by resume-driven development | Team unfamiliar, high learning curve | Choose what the team knows and can operate |
| No database at all for AI embeddings | Brute-force similarity search, O(n) | Use pgvector or dedicated vector DB |
| Ignoring managed services | Team spends 50% time on DB operations | Use RDS, Cloud SQL, Atlas, or equivalent |
| Premature polyglot persistence | 5 databases for 3 microservices | Start with one, split when justified by data |

---

## Real-world Examples

### Uber
- **PostgreSQL** for trip data and user profiles (ACID transactions)
- **MySQL** for legacy systems and Schemaless layer
- **Redis** for geospatial caching and rate limiting
- **Cassandra** for real-time driver location tracking (massive writes)
- **Elasticsearch** for trip search and log analysis

### Netflix
- **Cassandra** for user viewing history (billions of rows, global)
- **DynamoDB** for session management
- **Elasticsearch** for content search and discovery
- **EVCache (Memcached)** for application caching
- **CockroachDB** for newer transactional services

### Slack
- **MySQL** (Vitess) for messages and channels (sharded)
- **Redis** for presence, typing indicators, caching
- **Elasticsearch** for message search
- **Memcached** for hot-path caching

---

## Enforcement Checklist

- [ ] Database type chosen based on access pattern analysis, not trend
- [ ] ACID requirements documented — if needed, use relational
- [ ] Read/write ratio analyzed before selecting database
- [ ] Data volume projections considered for scaling path
- [ ] Operational expertise on team assessed
- [ ] Managed vs self-hosted decision made
- [ ] Backup and disaster recovery plan exists for chosen database
- [ ] Migration path considered if database choice proves wrong
- [ ] Single source of truth identified for each data entity
- [ ] Cross-database consistency strategy defined if polyglot
