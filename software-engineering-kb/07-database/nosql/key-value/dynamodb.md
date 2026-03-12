# DynamoDB

> **Domain:** Database > NoSQL > Key-Value
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Amazon DynamoDB is the gold standard for serverless, infinitely scalable key-value and document storage. It delivers single-digit millisecond performance at any scale — from 10 requests/second to 10 million requests/second — with zero operational overhead. Unlike self-managed databases, DynamoDB has no servers to provision, no patches to apply, no replication to configure. Its pricing model (pay-per-request or provisioned capacity) and integration with the AWS ecosystem (Lambda, API Gateway, Kinesis) make it the default database for serverless architectures. However, DynamoDB requires a fundamentally different data modeling approach — you must know your access patterns before designing the schema, and schema changes after deployment are extremely costly.

---

## How It Works

### Core Concepts

```
┌──────────────────────────────────────────────────────────┐
│                   DynamoDB Table                          │
│                                                           │
│  Partition Key (PK)  │  Sort Key (SK)    │  Attributes   │
│  ────────────────────┼───────────────────┼──────────────  │
│  USER#alice          │  PROFILE          │  name, email  │
│  USER#alice          │  ORDER#001        │  total, items │
│  USER#alice          │  ORDER#002        │  total, items │
│  USER#bob            │  PROFILE          │  name, email  │
│  USER#bob            │  ORDER#001        │  total, items │
│  PRODUCT#widget      │  METADATA         │  name, price  │
│  PRODUCT#widget      │  REVIEW#001       │  rating, text │
│                                                           │
│  PK: identifies the partition (determines physical shard) │
│  SK: sorts items within a partition (enables range queries)│
│  Together: PK + SK = unique item identifier               │
└──────────────────────────────────────────────────────────┘
```

**Key types:**
- **Partition key only** — simple key (like Redis key)
- **Partition key + Sort key** — composite key (enables range queries within partition)

```
Physical partitioning:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Partition 1 │  │  Partition 2 │  │  Partition 3 │
│              │  │              │  │              │
│ USER#alice   │  │ USER#bob     │  │ PRODUCT#*    │
│ (all items)  │  │ (all items)  │  │ (all items)  │
│              │  │              │  │              │
│ 10 GB max    │  │ 10 GB max    │  │ 10 GB max    │
│ 3000 RCU     │  │ 3000 RCU     │  │ 3000 RCU     │
│ 1000 WCU     │  │ 1000 WCU     │  │ 1000 WCU     │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

### Single-Table Design

The most critical DynamoDB concept — store all entities in ONE table with carefully designed PK/SK patterns.

```
┌─────────────────────────────────────────────────────────────────┐
│  Single Table Design: E-Commerce                                 │
│                                                                   │
│  PK              │ SK               │ GSI1PK       │ GSI1SK     │
│  ────────────────┼──────────────────┼──────────────┼──────────  │
│  USER#u1         │ PROFILE          │ EMAIL#a@x.com│            │
│  USER#u1         │ ORDER#o1         │ ORDER#o1     │ 2024-06-01│
│  USER#u1         │ ORDER#o2         │ ORDER#o2     │ 2024-06-15│
│  ORDER#o1        │ ITEM#p1          │ PRODUCT#p1   │ ORDER#o1  │
│  ORDER#o1        │ ITEM#p2          │ PRODUCT#p2   │ ORDER#o1  │
│  ORDER#o1        │ METADATA         │ STATUS#shipped│ 2024-06-01│
│  PRODUCT#p1      │ METADATA         │ CAT#electronics│           │
│  PRODUCT#p1      │ REVIEW#r1        │              │            │
└─────────────────────────────────────────────────────────────────┘

Access patterns served:
1. Get user profile: PK=USER#u1, SK=PROFILE
2. Get user's orders: PK=USER#u1, SK begins_with("ORDER#")
3. Get order items: PK=ORDER#o1, SK begins_with("ITEM#")
4. Get user by email: GSI1PK=EMAIL#a@x.com
5. Get orders by status: GSI1PK=STATUS#shipped, GSI1SK between dates
6. Get product reviews: PK=PRODUCT#p1, SK begins_with("REVIEW#")
```

---

### CRUD Operations

```typescript
// TypeScript — AWS SDK v3
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, PutCommand, GetCommand,
  QueryCommand, UpdateCommand, DeleteCommand
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = 'MyApp';

// PUT (create or overwrite)
await client.send(new PutCommand({
  TableName: TABLE,
  Item: {
    PK: 'USER#alice',
    SK: 'PROFILE',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    createdAt: new Date().toISOString(),
  },
  ConditionExpression: 'attribute_not_exists(PK)',  // prevent overwrite
}));

// GET (single item by exact key)
const { Item } = await client.send(new GetCommand({
  TableName: TABLE,
  Key: { PK: 'USER#alice', SK: 'PROFILE' },
}));

// QUERY (items within same partition)
const { Items } = await client.send(new QueryCommand({
  TableName: TABLE,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': 'USER#alice',
    ':sk': 'ORDER#',
  },
  ScanIndexForward: false,  // descending order
  Limit: 10,
}));

// UPDATE (modify specific attributes)
await client.send(new UpdateCommand({
  TableName: TABLE,
  Key: { PK: 'USER#alice', SK: 'PROFILE' },
  UpdateExpression: 'SET #name = :name, loginCount = if_not_exists(loginCount, :zero) + :one',
  ExpressionAttributeNames: { '#name': 'name' },
  ExpressionAttributeValues: { ':name': 'Alice Smith', ':zero': 0, ':one': 1 },
}));

// CONDITIONAL UPDATE (optimistic locking)
await client.send(new UpdateCommand({
  TableName: TABLE,
  Key: { PK: 'PRODUCT#widget', SK: 'METADATA' },
  UpdateExpression: 'SET stock = stock - :qty, version = version + :one',
  ConditionExpression: 'stock >= :qty AND version = :expectedVersion',
  ExpressionAttributeValues: {
    ':qty': 2,
    ':one': 1,
    ':expectedVersion': 5,
  },
}));

// DELETE
await client.send(new DeleteCommand({
  TableName: TABLE,
  Key: { PK: 'USER#alice', SK: 'PROFILE' },
}));
```

---

### Global Secondary Indexes (GSI)

```
Main Table:                         GSI1:
PK          │ SK                    GSI1PK        │ GSI1SK
────────────┼──────────             ──────────────┼───────────
USER#alice  │ ORDER#o1    ───►      STATUS#shipped│ 2024-06-01
USER#alice  │ ORDER#o2    ───►      STATUS#pending│ 2024-06-15
USER#bob    │ ORDER#o3    ───►      STATUS#shipped│ 2024-06-10

GSI enables different access patterns on the same data.
Project only needed attributes to minimize GSI storage cost.
```

```typescript
// Query GSI
const { Items } = await client.send(new QueryCommand({
  TableName: TABLE,
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :status AND GSI1SK BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':status': 'STATUS#shipped',
    ':start': '2024-06-01',
    ':end': '2024-06-30',
  },
}));
```

**GSI limits:** Max 20 GSIs per table. Each GSI adds write cost (every table write replicates to GSI). Eventually consistent reads only.

---

### Transactions

```typescript
import { TransactWriteCommand, TransactGetCommand } from '@aws-sdk/lib-dynamodb';

// Transactional write (up to 100 items, ACID)
await client.send(new TransactWriteCommand({
  TransactItems: [
    {
      Update: {
        TableName: TABLE,
        Key: { PK: 'ACCOUNT#alice', SK: 'BALANCE' },
        UpdateExpression: 'SET balance = balance - :amount',
        ConditionExpression: 'balance >= :amount',
        ExpressionAttributeValues: { ':amount': 100 },
      },
    },
    {
      Update: {
        TableName: TABLE,
        Key: { PK: 'ACCOUNT#bob', SK: 'BALANCE' },
        UpdateExpression: 'SET balance = balance + :amount',
        ExpressionAttributeValues: { ':amount': 100 },
      },
    },
    {
      Put: {
        TableName: TABLE,
        Item: {
          PK: 'TRANSFER#t001',
          SK: 'METADATA',
          from: 'alice', to: 'bob', amount: 100,
          timestamp: new Date().toISOString(),
        },
      },
    },
  ],
}));
```

---

### DynamoDB Streams & Event-Driven

```
┌──────────┐    Stream    ┌──────────┐    Invoke    ┌──────────┐
│ DynamoDB │─────────────►│ DynamoDB │─────────────►│  Lambda  │
│  Table   │              │  Stream  │              │ Function │
└──────────┘              └──────────┘              └──────────┘

Stream events: INSERT, MODIFY, REMOVE
Contains: old image, new image, or both
Retention: 24 hours
```

---

### Capacity Modes

| Mode | Pricing | Best For |
|------|---------|----------|
| **On-Demand** | Pay per request ($1.25/million WCU, $0.25/million RCU) | Unpredictable traffic, new applications |
| **Provisioned** | Pay for reserved capacity ($0.00065/WCU/hr, $0.00013/RCU/hr) | Predictable traffic, cost optimization |
| **Provisioned + Auto Scaling** | Scale within bounds | Variable but somewhat predictable |

**RCU/WCU:**
- 1 RCU = 1 strongly consistent read/sec (up to 4 KB)
- 1 RCU = 2 eventually consistent reads/sec (up to 4 KB)
- 1 WCU = 1 write/sec (up to 1 KB)

---

## Best Practices

1. **ALWAYS define access patterns before designing schema** — DynamoDB schema cannot be easily changed
2. **ALWAYS use single-table design** — minimize table count, maximize efficiency
3. **ALWAYS use composite keys (PK + SK)** — enables flexible query patterns
4. **ALWAYS use GSIs sparingly** — each adds write cost and storage
5. **ALWAYS use condition expressions** for writes — prevent race conditions
6. **ALWAYS use on-demand mode** for new applications — switch to provisioned when patterns stabilize
7. **ALWAYS use DynamoDB Streams** for event-driven architecture — not polling
8. **NEVER do table scans** in production — always use Query with partition key
9. **NEVER use FilterExpression** as primary query mechanism — it scans then filters (expensive)
10. **NEVER store large items** — 400 KB item limit, use S3 for large objects

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Table per entity (relational thinking) | Too many tables, no transactions across | Single-table design |
| Scan instead of Query | High cost, slow, reads entire table | Design keys for Query access |
| FilterExpression for primary filtering | Reads and discards data (expensive) | Use key conditions and GSIs |
| Hot partition | Throttling on one partition | Better key distribution, write sharding |
| No condition expressions on writes | Race conditions, data corruption | ConditionExpression on critical writes |
| Large items near 400 KB | Write failures, high cost | Store large data in S3, reference in DynamoDB |
| Too many GSIs | High write cost multiplication | Design composite keys to minimize GSIs |
| Relational data model | Complex multi-table queries impossible | Single-table with composite keys |
| No TTL on temporary data | Table grows indefinitely | Enable TTL attribute |
| Provisioned capacity without auto-scaling | Throttling during peaks | Enable auto-scaling or use on-demand |

---

## Real-world Examples

### Amazon
- DynamoDB created for Amazon.com shopping cart (2012)
- Handles millions of requests per second during Prime Day
- Single-digit millisecond latency at any scale

### Netflix
- DynamoDB for user preferences, viewing history, bookmarks
- Billions of items, global tables for multi-region

### Lyft
- DynamoDB for ride matching and location data
- On-demand capacity for peak hours (surge pricing events)

### Capital One
- DynamoDB for real-time fraud detection
- Sub-millisecond lookups for transaction validation

---

## Enforcement Checklist

- [ ] Access patterns documented before schema design
- [ ] Single-table design used (or justified multi-table)
- [ ] Composite keys (PK + SK) used for flexible queries
- [ ] GSIs created only for access patterns that cannot use main table keys
- [ ] Condition expressions used on all critical writes
- [ ] On-demand capacity for new applications
- [ ] DynamoDB Streams enabled for event-driven patterns
- [ ] TTL configured for temporary data
- [ ] No Scan operations in production code
- [ ] Item sizes kept well under 400 KB limit
