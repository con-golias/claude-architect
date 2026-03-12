# When to Use Graph Databases

> **Domain:** Database > NoSQL > Graph
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Graph databases are powerful but frequently misapplied. Choosing a graph database for simple CRUD operations adds complexity without benefit. Choosing a relational database for deeply connected data leads to recursive CTEs, exponential JOIN counts, and query times that grow with data size. The decision between graph and relational must be based on the nature of the relationships in your data — not on trends or perceived modernity.

---

## How It Works

### Decision Framework

```
Does your core query involve traversing relationships?
├── NO → Relational database (PostgreSQL)
└── YES
    │
    How deep are the traversals?
    ├── 1-2 levels (user → orders → items) → Relational (JOINs are fine)
    └── 3+ levels (friend → friend → friend → ...)
        │
        Are relationships the primary query pattern?
        ├── NO (occasional graph query) → PostgreSQL with recursive CTE or ltree
        └── YES (most queries are traversals)
            │
            Scale of data?
            ├── < 10M nodes → Neo4j (mature, Cypher, GDS algorithms)
            ├── > 10M nodes, need analytics → Neo4j or Amazon Neptune
            └── > 1B edges, need real-time → Custom (JanusGraph, DGraph)
```

### Ideal Use Cases

| Use Case | Why Graph | Example Query |
|----------|-----------|---------------|
| **Social networks** | Friends-of-friends, mutual connections | "Find people Alice knows through Bob" |
| **Fraud detection** | Ring patterns, connected accounts | "Find accounts sharing IP, device, and address" |
| **Recommendation** | Co-purchase, collaborative filtering | "Users who bought X also bought Y" |
| **Knowledge graphs** | Entity relationships, reasoning | "What diseases are related to gene X?" |
| **Access control** | Permission inheritance, group membership | "Does user X have access to resource Y through any group?" |
| **Network/IT** | Dependency mapping, impact analysis | "Which services are affected if server Z goes down?" |
| **Supply chain** | Path optimization, tracking | "Trace product from manufacturer to retailer" |

### When NOT to Use Graph

| Use Case | Why NOT Graph | Better Alternative |
|----------|--------------|-------------------|
| Simple CRUD | No relationship traversal needed | PostgreSQL, MongoDB |
| Time-series | Sequential data, not connections | TimescaleDB, InfluxDB |
| Full-text search | Text matching, not graph traversal | Elasticsearch, PostgreSQL FTS |
| Document storage | Flexible schema, not relationships | MongoDB, Firestore |
| Key-value cache | Fast lookups by key | Redis |
| Analytics/BI | Aggregation, not traversal | PostgreSQL, ClickHouse |
| E-commerce catalog | Products + categories (shallow, 2 levels) | PostgreSQL with JOINs |

---

### Graph vs Relational Performance

```
Query: "Find all friends-of-friends-of-friends (3 hops)"

Relational (PostgreSQL):
SELECT DISTINCT f3.name
FROM follows f1
JOIN follows f2 ON f1.target = f2.source
JOIN follows f3 ON f2.target = f3.source
WHERE f1.source = 'alice';

Performance by data size:
Users    | PostgreSQL  | Neo4j
---------|-------------|--------
1,000    | 5ms         | 2ms
100,000  | 200ms       | 5ms
1,000,000| 15 sec      | 20ms
10,000,000| 5+ min     | 50ms

Graph databases: O(k) — proportional to result set
Relational JOINs: O(n²) to O(n³) — proportional to table size

At 1M+ users with deep traversals, graphs win by 100-1000x.
At < 100K users with shallow queries, PostgreSQL is fine.
```

---

### Hybrid Architecture

```
┌──────────────────────────────────────────────────────┐
│              Hybrid Architecture                      │
│                                                       │
│  ┌──────────────┐        ┌──────────────────┐       │
│  │ PostgreSQL   │        │ Neo4j            │       │
│  │              │ sync   │                   │       │
│  │ Users table  │───────►│ User nodes       │       │
│  │ Orders table │        │ Relationship     │       │
│  │ Products     │        │ edges            │       │
│  │              │        │                   │       │
│  │ CRUD ops     │        │ Graph queries    │       │
│  │ Transactions │        │ Recommendations  │       │
│  │ Reporting    │        │ Fraud detection  │       │
│  └──────────────┘        └──────────────────┘       │
│                                                       │
│  PostgreSQL: source of truth (CRUD, transactions)    │
│  Neo4j: specialized read store (graph queries)       │
│  CDC or event-driven sync between them               │
└──────────────────────────────────────────────────────┘
```

---

### Graph Database Comparison

| Database | Model | Query Language | Hosting | Best For |
|----------|-------|---------------|---------|----------|
| **Neo4j** | Property Graph | Cypher | Self-hosted, Aura | General-purpose graph, algorithms |
| **Amazon Neptune** | Property + RDF | Cypher, Gremlin, SPARQL | AWS managed | AWS ecosystem, knowledge graphs |
| **JanusGraph** | Property Graph | Gremlin | Self-hosted | Massive scale (storage backends: Cassandra, HBase) |
| **DGraph** | Property Graph | GraphQL+- | Self-hosted, cloud | High-performance, native GraphQL |
| **ArangoDB** | Multi-model | AQL | Self-hosted, cloud | Graph + Document + Key-Value in one |
| **TigerGraph** | Property Graph | GSQL | Self-hosted, cloud | Real-time deep link analytics |

---

## Best Practices

1. **ALWAYS validate that graph queries are the primary access pattern** before choosing a graph DB
2. **ALWAYS start with PostgreSQL recursive CTEs** for occasional graph queries — avoid new infrastructure
3. **ALWAYS use hybrid architecture** — PostgreSQL for CRUD, graph DB for traversals
4. **ALWAYS prototype with Neo4j** first — most mature, best tooling and documentation
5. **ALWAYS measure traversal depth** — if most queries are 1-2 hops, relational is sufficient
6. **NEVER use graph DB as primary OLTP store** — lack ACID guarantees of relational databases
7. **NEVER over-model** — not every relationship needs a graph; simple FK JOINs are fine for most
8. **NEVER choose graph DB based on hype** — most applications never need graph traversals

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Graph DB for simple CRUD | Complexity without benefit | Use PostgreSQL |
| Graph DB for everything | Hybrid model ignored | PostgreSQL for CRUD + Neo4j for graph queries |
| Deep traversals in relational DB | Exponential query time, timeouts | Move graph queries to Neo4j |
| No depth limit on traversals | Query traverses entire graph | Bound traversal depth |
| Choosing graph DB for 2-level JOINs | Over-engineering | PostgreSQL JOINs are efficient at 2 levels |
| Ignoring data sync complexity | Graph DB out of sync with primary | Use CDC or event-driven sync |

---

## Real-world Examples

### LinkedIn (Graph + Relational Hybrid)
- Neo4j-inspired custom graph engine for connections
- PostgreSQL for user profiles, job listings
- Graph queries for "People You May Know," "Skills" recommendations

### PayPal (Fraud Detection)
- Graph database to detect fraud rings
- Connected component analysis: shared devices, IPs, addresses
- Real-time traversal during transaction processing

### Walmart (Supply Chain)
- Graph database for supply chain traceability
- Product journey from manufacturer to store shelf
- Impact analysis: "Which products are affected by this supplier delay?"

---

## Enforcement Checklist

- [ ] Graph database need validated (3+ hop traversals are core queries)
- [ ] PostgreSQL recursive CTE evaluated as simpler alternative
- [ ] Hybrid architecture designed (CRUD in relational, traversals in graph)
- [ ] Traversal depths bounded in all queries
- [ ] Data synchronization mechanism designed (CDC or events)
- [ ] Neo4j chosen as default unless specific scale requirement
- [ ] Graph not used as primary OLTP database
- [ ] Performance benchmarked against PostgreSQL for actual query patterns
