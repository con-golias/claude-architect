# Neo4j & Graph Databases

> **Domain:** Database > NoSQL > Graph
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Graph databases model relationships as first-class citizens. While relational databases express connections through foreign keys and JOIN operations, graph databases store relationships directly as edges between nodes. This makes traversals across deeply connected data — social networks, fraud detection, recommendation engines, knowledge graphs — orders of magnitude faster. A 6-degree relationship query that takes minutes with recursive JOINs in PostgreSQL completes in milliseconds in Neo4j. Neo4j is the most mature and widely adopted graph database, with the Cypher query language as the industry standard.

---

## How It Works

### Graph Data Model

```
Property Graph Model:
┌────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┐    FOLLOWS    ┌──────────────┐      │
│  │   Node       │──────────────►│    Node       │      │
│  │              │               │               │      │
│  │  :Person     │    LIKES      │  :Person      │      │
│  │  name: Alice │──────────────►│  name: Bob    │      │
│  │  age: 32     │               │  age: 28      │      │
│  └──────┬───────┘               └──────┬────────┘      │
│         │                              │                │
│         │ WROTE                        │ WROTE          │
│         ▼                              ▼                │
│  ┌──────────────┐               ┌──────────────┐      │
│  │   :Article   │    TAGGED     │   :Article   │      │
│  │  title: "..." │──────────────►│  title: "..." │      │
│  │  date: 2024  │  :Tag         │              │      │
│  └──────────────┘  name: "DB"   └──────────────┘      │
│                                                         │
│  Nodes: entities (Person, Article, Tag)                │
│  Relationships: directed, typed, with properties       │
│  Properties: key-value pairs on both nodes and edges   │
│  Labels: node types (can have multiple)                │
└────────────────────────────────────────────────────────┘
```

### Cypher Query Language

```cypher
// CREATE nodes
CREATE (alice:Person {name: 'Alice', age: 32, email: 'alice@example.com'})
CREATE (bob:Person {name: 'Bob', age: 28})
CREATE (article:Article {title: 'Graph Databases 101', date: date('2024-06-01')})

// CREATE relationships
CREATE (alice)-[:FOLLOWS {since: date('2024-01-15')}]->(bob)
CREATE (alice)-[:WROTE]->(article)
CREATE (bob)-[:LIKES {rating: 5}]->(article)

// MATCH (query) — find nodes and relationships
MATCH (p:Person {name: 'Alice'})
RETURN p;

// Find Alice's followers
MATCH (follower:Person)-[:FOLLOWS]->(alice:Person {name: 'Alice'})
RETURN follower.name;

// Find friends of friends (2-degree connection)
MATCH (alice:Person {name: 'Alice'})-[:FOLLOWS]->()-[:FOLLOWS]->(fof:Person)
WHERE fof <> alice
RETURN DISTINCT fof.name;

// Variable-length path (1 to 5 hops)
MATCH path = (alice:Person {name: 'Alice'})-[:FOLLOWS*1..5]->(target:Person)
RETURN target.name, length(path) AS distance
ORDER BY distance;

// Shortest path
MATCH path = shortestPath(
  (alice:Person {name: 'Alice'})-[:FOLLOWS*]-(bob:Person {name: 'Bob'})
)
RETURN path;

// Aggregation
MATCH (p:Person)-[:WROTE]->(a:Article)
RETURN p.name, COUNT(a) AS articles_written
ORDER BY articles_written DESC
LIMIT 10;

// Pattern matching with WHERE
MATCH (p:Person)-[r:LIKES]->(a:Article)
WHERE r.rating >= 4 AND a.date > date('2024-01-01')
RETURN p.name, a.title, r.rating;

// UPDATE
MATCH (p:Person {name: 'Alice'})
SET p.age = 33, p.updatedAt = datetime();

// DELETE
MATCH (p:Person {name: 'Alice'})-[r:FOLLOWS]->(bob:Person {name: 'Bob'})
DELETE r;  // delete relationship

// DELETE node (must delete relationships first)
MATCH (p:Person {name: 'OldUser'})
DETACH DELETE p;  // delete node and all its relationships

// MERGE (upsert)
MERGE (p:Person {email: 'alice@example.com'})
ON CREATE SET p.name = 'Alice', p.createdAt = datetime()
ON MATCH SET p.lastLogin = datetime();
```

---

### Indexing & Constraints

```cypher
// Unique constraint (also creates index)
CREATE CONSTRAINT person_email_unique
FOR (p:Person) REQUIRE p.email IS UNIQUE;

// Node key constraint (composite unique)
CREATE CONSTRAINT order_key
FOR (o:Order) REQUIRE (o.customerId, o.orderId) IS NODE KEY;

// Existence constraint
CREATE CONSTRAINT person_name_exists
FOR (p:Person) REQUIRE p.name IS NOT NULL;

// Index for faster lookups
CREATE INDEX person_name_index FOR (p:Person) ON (p.name);

// Composite index
CREATE INDEX order_lookup FOR (o:Order) ON (o.status, o.date);

// Full-text index
CREATE FULLTEXT INDEX article_search FOR (a:Article) ON EACH [a.title, a.body];

// Query with full-text index
CALL db.index.fulltext.queryNodes('article_search', 'graph database')
YIELD node, score
RETURN node.title, score
ORDER BY score DESC
LIMIT 10;

// Relationship index (Neo4j 5+)
CREATE INDEX follows_since FOR ()-[r:FOLLOWS]-() ON (r.since);
```

---

### Graph Algorithms

```cypher
// PageRank (importance scoring)
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
LIMIT 10;

// Community detection (Louvain)
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).name) AS members
ORDER BY size(members) DESC;

// Shortest path (Dijkstra)
CALL gds.shortestPath.dijkstra.stream('myGraph', {
  sourceNode: aliceId,
  targetNode: bobId,
  relationshipWeightProperty: 'distance'
})
YIELD totalCost, path
RETURN totalCost, [n IN nodes(path) | n.name] AS route;

// Node similarity
CALL gds.nodeSimilarity.stream('myGraph')
YIELD node1, node2, similarity
RETURN gds.util.asNode(node1).name AS person1,
       gds.util.asNode(node2).name AS person2,
       similarity
ORDER BY similarity DESC
LIMIT 10;
```

---

### Application Integration

```typescript
// TypeScript — Neo4j driver
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'neo4j://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function findFriendsOfFriends(userId: string) {
  const session = driver.session({ database: 'neo4j' });
  try {
    const result = await session.run(`
      MATCH (user:Person {id: $userId})-[:FOLLOWS]->()-[:FOLLOWS]->(fof:Person)
      WHERE fof <> user AND NOT (user)-[:FOLLOWS]->(fof)
      RETURN DISTINCT fof.name AS name, fof.id AS id,
             COUNT(*) AS mutualFriends
      ORDER BY mutualFriends DESC
      LIMIT 10
    `, { userId });

    return result.records.map(r => ({
      name: r.get('name'),
      id: r.get('id'),
      mutualFriends: r.get('mutualFriends').toNumber(),
    }));
  } finally {
    await session.close();
  }
}
```

```go
// Go — Neo4j driver
func FindShortestPath(ctx context.Context, driver neo4j.DriverWithContext, fromID, toID string) ([]string, error) {
    session := driver.NewSession(ctx, neo4j.SessionConfig{DatabaseName: "neo4j"})
    defer session.Close(ctx)

    result, err := session.Run(ctx, `
        MATCH path = shortestPath(
            (a:Person {id: $from})-[:FOLLOWS*]-(b:Person {id: $to})
        )
        RETURN [n IN nodes(path) | n.name] AS route
    `, map[string]any{"from": fromID, "to": toID})
    if err != nil {
        return nil, err
    }

    if result.Next(ctx) {
        route, _ := result.Record().Get("route")
        names := make([]string, 0)
        for _, v := range route.([]any) {
            names = append(names, v.(string))
        }
        return names, nil
    }
    return nil, fmt.Errorf("no path found")
}
```

---

## Best Practices

1. **ALWAYS model relationships as first-class edges** — not as properties or intermediary nodes
2. **ALWAYS use parameterized Cypher queries** — prevent injection, enable plan caching
3. **ALWAYS create indexes on frequently queried properties** — Node labels alone are not enough
4. **ALWAYS use MERGE for idempotent creation** — prevents duplicate nodes
5. **ALWAYS limit variable-length path queries** — `*1..5` not `*` (unbounded is dangerous)
6. **ALWAYS use GDS library** for graph algorithms — do not implement manually
7. **NEVER use Neo4j for simple CRUD** — overhead not justified without relationship traversals
8. **NEVER store time-series data in a graph** — graphs are for relationships, not sequences
9. **NEVER create super-nodes** (millions of relationships on one node) — causes hot spots
10. **NEVER use unbounded variable-length paths** — can traverse entire graph, OOM

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using graph DB for simple CRUD | Overhead without relationship benefit | Use PostgreSQL or MongoDB |
| Unbounded path queries (*) | Query traverses entire graph, OOM | Always set max depth (*1..N) |
| No indexes on query properties | Slow node lookups (full scan) | Create index on filtered properties |
| Super-nodes (celebrity problem) | One node with millions of edges, slow traversal | Partition super-nodes or use bidirectional queries |
| Storing data better suited for relational | Complex model, worse performance | Use graph only for relationship-heavy data |
| String concatenation in Cypher | Cypher injection vulnerability | Use parameterized queries ($param) |
| Not using MERGE for creates | Duplicate nodes on retry | MERGE with ON CREATE SET |
| Ignoring relationship direction | Wrong traversal results | Define direction: -[:FOLLOWS]-> |

---

## Real-world Examples

### LinkedIn
- Graph database for social network connections
- "People You May Know" powered by graph traversal
- Skills endorsement graph for recommendation

### NASA
- Knowledge graph for space mission data
- Relationship traversal across missions, equipment, personnel
- Graph analytics for failure analysis

### Airbnb
- Fraud detection using graph patterns
- Connected component analysis for fraudulent listing rings
- Trust scoring based on review graph

### eBay
- Shipping route optimization
- Product recommendation based on co-purchase graphs
- Seller relationship analysis

---

## Enforcement Checklist

- [ ] Graph database justified (relationship traversals are core requirement)
- [ ] Indexes created on all properties used in MATCH WHERE clauses
- [ ] Unique constraints on identifier properties
- [ ] Variable-length paths bounded (*1..N)
- [ ] Parameterized Cypher queries used (no string concatenation)
- [ ] MERGE used for idempotent node/relationship creation
- [ ] Super-nodes identified and handled (partitioning or limiting traversal)
- [ ] GDS library used for graph algorithms
- [ ] Transactions used for multi-statement writes
- [ ] Session management (close sessions after use)
