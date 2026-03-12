# MongoDB

> **Domain:** Database > NoSQL > Document Stores
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

MongoDB is the most widely used document database — the default NoSQL choice for applications needing flexible schemas, nested data, and horizontal scaling. Unlike relational databases where data must fit rigid table structures, MongoDB stores documents as BSON (binary JSON), allowing each document to have different fields. This maps directly to application objects, eliminating the object-relational impedance mismatch. MongoDB's strengths — flexible schema, horizontal sharding, rich query language, and developer experience — make it ideal for content management, catalogs, user profiles, and event storage. Understanding its data model, indexing, aggregation pipeline, replication, and sharding is essential for any backend engineer working with document databases.

---

## How It Works

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                   MongoDB Cluster                     │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │            Replica Set (Primary + Secondaries)  │  │
│  │                                                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ Primary  │  │Secondary │  │Secondary │     │  │
│  │  │ (R/W)    │──│ (R/O)    │──│ (R/O)    │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘     │  │
│  │       │                                          │  │
│  │       │ Oplog replication (capped collection)    │  │
│  └───────┼──────────────────────────────────────────┘  │
│          │                                              │
│  ┌───────▼──────────────────────────────────────────┐  │
│  │                  Storage Engine                    │  │
│  │  WiredTiger (default since 3.2)                   │  │
│  │  • Document-level locking                         │  │
│  │  • Compression (snappy, zstd, zlib)               │  │
│  │  • B-tree indexes                                  │  │
│  │  • Journaling (WAL equivalent)                    │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Data Model

```javascript
// MongoDB document (BSON — binary JSON)
{
  _id: ObjectId("65a1b2c3d4e5f6a7b8c9d0e1"),  // auto-generated unique ID
  name: "Alice Johnson",
  email: "alice@example.com",
  age: 32,
  address: {                    // embedded document (denormalized)
    street: "123 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701"
  },
  roles: ["admin", "editor"],   // array
  preferences: {                // nested object
    theme: "dark",
    notifications: { email: true, sms: false }
  },
  orders: [                     // embedded array of documents
    { product: "Widget", qty: 2, price: 29.99, date: ISODate("2024-06-01") },
    { product: "Gadget", qty: 1, price: 49.99, date: ISODate("2024-06-15") }
  ],
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-06-15T14:22:00Z")
}
```

**Embedding vs Referencing:**

| Strategy | When | Example |
|----------|------|---------|
| **Embed** (denormalize) | Data always accessed together, 1:few relation | User → Address, Order → LineItems |
| **Reference** (normalize) | Data shared across documents, 1:many/many:many | User → Orders (separate collection) |
| **Hybrid** | Embed summary, reference detail | Order embeds product name/price, references full product |

```javascript
// Reference pattern (like FK in relational)
// orders collection
{
  _id: ObjectId("..."),
  userId: ObjectId("65a1b2c3d4e5f6a7b8c9d0e1"),  // reference
  items: [
    { productId: ObjectId("..."), qty: 2, unitPrice: 29.99 }
  ],
  total: 109.97,
  status: "shipped"
}

// Lookup (equivalent to JOIN)
db.orders.aggregate([
  { $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
  }},
  { $unwind: "$user" }
]);
```

---

### CRUD Operations

```javascript
// INSERT
db.users.insertOne({
  name: "Bob",
  email: "bob@example.com",
  roles: ["viewer"]
});

db.users.insertMany([
  { name: "Carol", email: "carol@example.com" },
  { name: "Dave", email: "dave@example.com" }
]);

// FIND (query)
db.users.find({ age: { $gte: 18 } });                   // comparison
db.users.find({ roles: "admin" });                        // array contains
db.users.find({ "address.city": "Springfield" });         // nested field
db.users.find({ $or: [{ age: { $lt: 18 } }, { roles: "admin" }] }); // logical
db.users.find({ tags: { $in: ["premium", "enterprise"] } }); // IN
db.users.find({ email: /^alice/i });                       // regex

// Projection (select specific fields)
db.users.find({ age: { $gte: 18 } }, { name: 1, email: 1, _id: 0 });

// Sort, skip, limit (pagination)
db.users.find().sort({ createdAt: -1 }).skip(20).limit(10);

// UPDATE
db.users.updateOne(
  { _id: ObjectId("...") },
  {
    $set: { name: "Alice Smith", "address.city": "Chicago" },
    $push: { roles: "moderator" },
    $inc: { loginCount: 1 },
    $currentDate: { updatedAt: true }
  }
);

// Upsert (insert if not exists)
db.users.updateOne(
  { email: "new@example.com" },
  { $set: { name: "New User" }, $setOnInsert: { createdAt: new Date() } },
  { upsert: true }
);

// Array operations
db.users.updateOne(
  { _id: ObjectId("...") },
  { $addToSet: { roles: "editor" } }       // add if not exists
);
db.users.updateOne(
  { _id: ObjectId("...") },
  { $pull: { roles: "viewer" } }            // remove from array
);

// DELETE
db.users.deleteOne({ _id: ObjectId("...") });
db.users.deleteMany({ status: "inactive", lastLogin: { $lt: ISODate("2023-01-01") } });
```

---

### Indexing

```javascript
// Single field index
db.users.createIndex({ email: 1 });        // ascending
db.orders.createIndex({ createdAt: -1 });   // descending

// Compound index (order matters — leftmost prefix rule applies)
db.orders.createIndex({ userId: 1, status: 1, createdAt: -1 });

// Unique index
db.users.createIndex({ email: 1 }, { unique: true });

// Partial index (like PostgreSQL partial index)
db.orders.createIndex(
  { createdAt: -1 },
  { partialFilterExpression: { status: "active" } }
);

// TTL index (auto-delete documents after time)
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Documents deleted when expiresAt < now()

// Text index (full-text search)
db.articles.createIndex({ title: "text", body: "text" });
db.articles.find({ $text: { $search: "mongodb indexing" } });

// Multikey index (automatically indexes array elements)
db.users.createIndex({ roles: 1 });
// Automatically indexes each element in the roles array

// Wildcard index (flexible schema)
db.events.createIndex({ "metadata.$**": 1 });
// Indexes all fields under metadata, regardless of structure

// Explain query plan
db.users.find({ email: "alice@example.com" }).explain("executionStats");
```

---

### Aggregation Pipeline

```javascript
// Multi-stage data processing pipeline
db.orders.aggregate([
  // Stage 1: Filter
  { $match: { status: "completed", createdAt: { $gte: ISODate("2024-01-01") } } },

  // Stage 2: Lookup (JOIN)
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
  { $unwind: "$user" },

  // Stage 3: Group by month
  { $group: {
      _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
      totalRevenue: { $sum: "$total" },
      orderCount: { $sum: 1 },
      avgOrderValue: { $avg: "$total" },
      uniqueCustomers: { $addToSet: "$userId" }
  }},

  // Stage 4: Add computed fields
  { $addFields: {
      customerCount: { $size: "$uniqueCustomers" },
      revenuePerCustomer: { $divide: ["$totalRevenue", { $size: "$uniqueCustomers" }] }
  }},

  // Stage 5: Sort
  { $sort: { "_id.year": 1, "_id.month": 1 } },

  // Stage 6: Project (select fields)
  { $project: { uniqueCustomers: 0 } }
]);

// Common aggregation stages:
// $match     - filter documents (use early for performance)
// $group     - group by key, apply accumulators ($sum, $avg, $min, $max)
// $sort      - sort results
// $limit     - limit output
// $skip      - skip documents
// $project   - reshape documents (include/exclude/compute fields)
// $unwind    - deconstruct array (one document per element)
// $lookup    - left outer join with another collection
// $addFields - add computed fields
// $facet     - multiple pipelines in parallel
// $bucket    - group into ranges
// $out       - write results to collection
// $merge     - upsert results into collection
```

---

### Replication & Sharding

```
Replica Set:
┌──────────┐     oplog      ┌──────────┐     oplog      ┌──────────┐
│ Primary  │────────────────►│Secondary │────────────────►│Secondary │
│ (R/W)    │                 │ (R/O)    │                 │ (R/O)    │
└──────────┘                 └──────────┘                 └──────────┘
     │                            │
     │ Automatic failover         │ Can become primary
     │ (election within seconds)  │ via election
```

```javascript
// Read preferences
db.users.find().readPref("primary");           // default: read from primary
db.users.find().readPref("primaryPreferred");  // primary if available, else secondary
db.users.find().readPref("secondary");         // read from secondary (may be stale)
db.users.find().readPref("secondaryPreferred"); // secondary if available
db.users.find().readPref("nearest");           // lowest latency node

// Write concerns
db.users.insertOne(
  { name: "Alice" },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
);
// w: "majority" — acknowledged by majority of replica set members
// j: true       — written to journal (durable)
// wtimeout      — timeout in milliseconds
```

```
Sharded Cluster:
┌──────────┐
│  mongos  │  ← Query router (application connects here)
│ (router) │
└────┬─────┘
     │
┌────▼─────────────────────────────────────┐
│         Config Servers (replica set)      │
│  Stores: shard key ranges, chunk metadata │
└────┬─────────────────────────────────────┘
     │
┌────▼────┐  ┌──────────┐  ┌──────────┐
│ Shard 1 │  │ Shard 2  │  │ Shard 3  │
│(replica │  │(replica  │  │(replica  │
│  set)   │  │  set)    │  │  set)    │
│ A-F     │  │ G-M      │  │ N-Z      │
└─────────┘  └──────────┘  └──────────┘
```

```javascript
// Enable sharding
sh.enableSharding("mydb");

// Shard key selection (most important decision)
sh.shardCollection("mydb.orders", { userId: "hashed" });  // hashed: even distribution
sh.shardCollection("mydb.events", { tenantId: 1, _id: 1 }); // compound: tenant isolation

// Good shard keys: high cardinality, even distribution, query pattern match
// Bad shard keys: monotonic (timestamp, ObjectId), low cardinality (status, country)
```

---

### Transactions (MongoDB 4.0+)

```javascript
// Multi-document transactions (replica set required)
const session = client.startSession();
try {
  session.startTransaction({
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" }
  });

  await db.collection("accounts").updateOne(
    { _id: fromAccountId },
    { $inc: { balance: -amount } },
    { session }
  );

  await db.collection("accounts").updateOne(
    { _id: toAccountId },
    { $inc: { balance: amount } },
    { session }
  );

  await db.collection("transfers").insertOne(
    { from: fromAccountId, to: toAccountId, amount, date: new Date() },
    { session }
  );

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### Change Streams (Real-Time)

```javascript
// Watch for changes (like PostgreSQL LISTEN/NOTIFY but persistent)
const changeStream = db.collection("orders").watch([
  { $match: { "fullDocument.status": "shipped" } }
]);

changeStream.on("change", (change) => {
  console.log("Operation:", change.operationType);
  console.log("Document:", change.fullDocument);
  // operationType: insert, update, replace, delete, invalidate
});

// Resume after disconnect (using resume token)
const resumeToken = changeStream.resumeToken;
const newStream = db.collection("orders").watch([], {
  resumeAfter: resumeToken
});
```

---

## Best Practices

1. **ALWAYS embed data that is accessed together** — avoid unnecessary $lookup (JOIN)
2. **ALWAYS create indexes for query patterns** — use explain() to verify
3. **ALWAYS use compound indexes matching query filter order** — leftmost prefix rule
4. **ALWAYS set write concern to "majority"** for critical data — prevents data loss on failover
5. **ALWAYS use TTL indexes** for session data and temporary documents
6. **ALWAYS choose shard keys based on query patterns** — not just even distribution
7. **ALWAYS use aggregation pipeline** instead of mapReduce — better performance, more features
8. **NEVER embed unbounded arrays** — document size limit is 16 MB
9. **NEVER use monotonic shard keys** (timestamp, ObjectId) — creates hot spots
10. **NEVER rely on transactions for core data model** — design documents to be self-contained

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Unbounded array growth | Document exceeds 16 MB limit | Use references for large arrays |
| No indexes on query fields | Full collection scan, slow queries | Create index matching query pattern |
| Relational design in MongoDB | Excessive $lookups, poor performance | Embed data accessed together |
| Monotonic shard key | One shard receives all writes (hot shard) | Use hashed or compound shard key |
| Read from primary for everything | Primary overloaded | Use secondaryPreferred for analytics |
| No write concern on critical data | Data loss on replica failover | Use w: "majority", j: true |
| mapReduce for aggregation | Slow, deprecated | Use aggregation pipeline |
| Missing validation | Invalid documents stored | Use schema validation ($jsonSchema) |
| Large documents (near 16 MB) | Insert/update failures | Split into references |
| No TTL on temporary data | Collections grow unbounded | TTL index for session/token data |

---

## Real-world Examples

### MongoDB Atlas (Managed Service)
- Auto-scaling clusters, global distribution
- Atlas Search (Lucene-based full-text search integrated)
- Atlas Vector Search for AI embeddings
- Change Streams for real-time event-driven architectures

### Adobe
- MongoDB for Adobe Experience Platform (content management)
- Flexible schema for diverse content types
- Horizontal scaling for global content delivery

### Cisco
- MongoDB for IoT device management (billions of documents)
- Time-series data storage for device metrics
- Sharded clusters across data centers

---

## Enforcement Checklist

- [ ] Data model uses embedding for co-accessed data (not relational style)
- [ ] Indexes created for all query patterns (verified with explain())
- [ ] Compound index order matches query filter order
- [ ] Write concern set to "majority" for critical collections
- [ ] Shard key chosen based on query patterns (not monotonic)
- [ ] Array fields bounded (no unbounded growth)
- [ ] TTL indexes used for temporary data (sessions, tokens)
- [ ] Schema validation enabled ($jsonSchema) for important collections
- [ ] Change Streams used instead of polling for real-time features
- [ ] Aggregation pipeline used instead of mapReduce
