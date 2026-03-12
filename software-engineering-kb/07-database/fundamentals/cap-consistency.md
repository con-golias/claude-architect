# CAP Theorem & Consistency Models

> **Domain:** Database > Fundamentals
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

The CAP theorem is the most misunderstood concept in distributed systems. It states that a distributed system can guarantee at most two of three properties: Consistency, Availability, and Partition tolerance. Since network partitions are inevitable in production, every distributed database makes a tradeoff between consistency and availability. Understanding these tradeoffs is critical: choose wrong and you get lost writes, stale reads, or complete unavailability when you need the system most. The PACELC extension adds the latency dimension, which matters even more in practice — most of the time, your system is NOT partitioned, and the real tradeoff is consistency vs latency.

---

## How It Works

### CAP Theorem

```
                        C
                    Consistency
                    (every read gets
                     the most recent write)
                       /\
                      /  \
                     /    \
                    /  CP  \
                   / Systems \
                  /  (Spanner, \
                 / CockroachDB, \
                /   HBase, etcd) \
               /──────────────────\
              /                    \
             /    CA (impossible    \
            /    in distributed      \
           /     systems with         \
          /      partitions)           \
         /                              \
        ──────────────────────────────────
       A                                  P
   Availability                    Partition Tolerance
   (every request gets            (system continues
    a response — no errors)        despite network splits)
              \                    /
               \      AP          /
                \   Systems      /
                 \ (Cassandra,  /
                  \ DynamoDB,  /
                   \ CouchDB) /
                    \        /
                     \      /
                      \    /
                       \  /
                        \/
```

**The Three Properties:**

| Property | Meaning | In Practice |
|----------|---------|-------------|
| **Consistency (C)** | Every read receives the most recent write or an error | All nodes see the same data at the same time |
| **Availability (A)** | Every request receives a non-error response | System never refuses a request (even if data is stale) |
| **Partition Tolerance (P)** | System continues operating despite network partitions | Nodes can be split into groups that cannot communicate |

**Critical insight:** Network partitions WILL happen (cables cut, switches fail, cloud AZs disconnect). So P is not optional. The real choice is:
- **CP:** When partition happens → refuse requests until consistency restored (e.g., return error)
- **AP:** When partition happens → serve requests with potentially stale data

---

### PACELC Extension

CAP only describes behavior during partitions. PACELC extends it to normal operation:

```
┌───────────────────────────────────────────────────────────┐
│                      PACELC Model                          │
│                                                            │
│  IF Partition (P):                                         │
│    Choose between Availability (A) vs Consistency (C)      │
│                                                            │
│  ELSE (E) — normal operation:                              │
│    Choose between Latency (L) vs Consistency (C)           │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Database        │ Partition │ Normal Operation        │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ PostgreSQL      │ PC       │ EC (strong consistency)  │ │
│  │ MySQL (InnoDB)  │ PC       │ EC (strong consistency)  │ │
│  │ CockroachDB     │ PC       │ EC (serializable)       │ │
│  │ Spanner         │ PC       │ EC (external consist.)  │ │
│  │ MongoDB         │ PA       │ EC (default write conc.) │ │
│  │ Cassandra       │ PA       │ EL (tunable)            │ │
│  │ DynamoDB        │ PA       │ EL (eventual by default)│ │
│  │ CouchDB         │ PA       │ EL (eventual)           │ │
│  │ Redis           │ PA       │ EL (async replication)  │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**In practice:** Most of the time, your system is NOT partitioned. The real everyday tradeoff is **latency vs consistency**:
- Strong consistency = higher latency (must coordinate across nodes)
- Eventual consistency = lower latency (respond immediately, sync later)

---

### Consistency Models

#### Linearizability (Strongest)

```
Client A:  ──write(x=1)──────────────────────────────────────────►
Client B:  ───────────────────read(x)──→ MUST return 1
Client C:  ───────────────────────────read(x)──→ MUST return 1

Timeline: ──────────────────────────────────────────────────►
                    ↑
              write completes
              All subsequent reads
              MUST see x=1
```

- Once a write completes, ALL subsequent reads (from any client) see the new value
- Equivalent to having a single copy of the data
- Most expensive to implement — requires coordination
- **Used by:** CockroachDB, Spanner, etcd, ZooKeeper

#### Sequential Consistency

- All operations appear in SOME total order
- Each client's operations appear in the order they were issued
- But different clients may see different orderings
- Weaker than linearizability (no real-time guarantee)

#### Causal Consistency

```
Client A:  write(x=1) ──────────── write(y=2, depends on x=1) ──►
Client B:  ───── read(y=2) ─── read(x) → MUST return 1 (causal)
Client C:  ───── read(x=1) ─── read(y) → MAY return null (no causal link seen)

If you see the EFFECT, you MUST see the CAUSE.
But unrelated writes can be seen in any order.
```

- If operation B depends on operation A, everyone sees A before B
- Unrelated operations can be seen in any order
- Good balance of consistency and performance
- **Used by:** MongoDB (with causal consistency sessions), some CRDTs

#### Eventual Consistency (Weakest)

```
Client A:  write(x=1) ──────────────────────────────────────────►
Client B:  ───── read(x) → 0 (stale!) ─── read(x) → 0 ─── read(x) → 1 ✓
                                                              ↑
                                                    eventually consistent

No guarantee WHEN the write becomes visible.
Only guarantee: IF no more writes happen, EVENTUALLY all reads return 1.
```

- If no new updates, eventually all replicas converge to the same value
- No guarantee on WHEN — could be milliseconds or seconds
- Allows highest availability and lowest latency
- **Used by:** DynamoDB (default), Cassandra (ONE/LOCAL_ONE), DNS, CDNs

---

### Consistency Model Comparison

| Model | Guarantee | Latency | Availability | Use Case |
|-------|-----------|---------|-------------|----------|
| **Linearizable** | Real-time ordering, freshest data | Highest | Lowest | Financial transactions, leader election |
| **Sequential** | Total order per client | High | Low | Distributed locks |
| **Causal** | Cause before effect | Medium | Medium | Social media feeds, collaborative editing |
| **Eventual** | Converges eventually | Lowest | Highest | Shopping carts, view counters, DNS |
| **Read-your-writes** | See your own writes | Low | High | User profile updates |
| **Monotonic reads** | Never see older data after newer | Low | High | Dashboard displays |

---

### Tunable Consistency

Some databases let you choose consistency level per-operation:

**Cassandra / ScyllaDB:**

```
Consistency Levels:
┌──────────────────────────────────────────────────────┐
│  Level        │ Writes to    │ Reads from    │ Note  │
├──────────────────────────────────────────────────────┤
│ ONE           │ 1 replica    │ 1 replica     │ Fast, may be stale │
│ QUORUM        │ N/2+1        │ N/2+1         │ Strong (W+R > N)   │
│ LOCAL_QUORUM  │ N/2+1 in DC  │ N/2+1 in DC   │ Strong within DC   │
│ ALL           │ All replicas │ All replicas  │ Slowest, most consistent │
│ EACH_QUORUM   │ Quorum in each DC │ —        │ Multi-DC strong    │
└──────────────────────────────────────────────────────┘

Strong consistency rule: R + W > N
  If N=3: QUORUM(2) reads + QUORUM(2) writes = 4 > 3 → Strong!
  If N=3: ONE(1) read + ALL(3) writes = 4 > 3 → Strong!
  If N=3: ONE(1) read + ONE(1) write = 2 < 3 → Eventual!
```

**DynamoDB:**

```
Read Consistency:
  Eventually Consistent Read (default) — 0.5 RCU per 4KB
  Strongly Consistent Read            — 1.0 RCU per 4KB (2x cost)

Write: Always durable to multiple AZs before acknowledging.
```

**MongoDB:**

```javascript
// Write concern — how many replicas must acknowledge
db.collection.insertOne(doc, {
  writeConcern: {
    w: "majority",         // Wait for majority of replicas
    j: true,               // Wait for journal write
    wtimeout: 5000         // Timeout after 5 seconds
  }
});

// Read concern — what data can be returned
db.collection.find(query).readConcern("majority");
// "local"    — return whatever this node has (default)
// "majority" — return data confirmed on majority of replicas
// "linearizable" — strongest, waits for all prior writes
```

---

### Conflict Resolution Strategies

When writes happen on multiple replicas simultaneously:

```
Node A:  set(x) = "Alice"  ──┐
                               ├── CONFLICT! Which value wins?
Node B:  set(x) = "Bob"    ──┘
```

| Strategy | How It Works | Used By |
|----------|-------------|---------|
| **Last-Write-Wins (LWW)** | Timestamp-based, latest write wins | Cassandra, DynamoDB |
| **Multi-Version Concurrency** | Keep all versions, resolve on read | CouchDB, Riak |
| **CRDTs** | Mathematically guaranteed to converge | Redis (CRDT), Riak |
| **Application-level** | Return all conflicting versions to app | CouchDB, DynamoDB (conditional writes) |
| **Consensus (Raft/Paxos)** | Agree on single value before writing | CockroachDB, etcd, ZooKeeper |

**Last-Write-Wins pitfall:**

```
Time T1: Node A sets price = $10.00 (timestamp: 1000)
Time T2: Node B sets price = $15.00 (timestamp: 1001)
Time T3: Node A sets price = $12.00 (timestamp: 999 ← clock skew!)

Result: price = $15.00 (timestamp 1001 wins)
Node A's $12.00 write is SILENTLY LOST.

Fix: Use logical clocks (vector clocks, Lamport timestamps)
     or consensus protocols instead of wall clock.
```

---

### Real-World Consistency Scenarios

**Scenario 1: E-commerce inventory**
```
Problem: Two users buy the last item simultaneously.
         With eventual consistency, both might succeed → oversell.

Solution: Use strong consistency (SERIALIZABLE isolation)
          or optimistic locking (version column).
          PostgreSQL: SELECT ... FOR UPDATE
          DynamoDB: ConditionExpression: "stock > 0"
```

**Scenario 2: Social media likes counter**
```
Problem: 10,000 users like a post simultaneously.
         Strong consistency would serialize all writes → slow.

Solution: Use eventual consistency — counter may temporarily
          show 9,997 instead of 10,000. Users do not notice.
          Cassandra: counter column type with QUORUM writes.
```

**Scenario 3: Banking transfer**
```
Problem: Transfer $100 from Account A to Account B.
         Must be atomic — cannot debit A without crediting B.

Solution: ACID transaction with SERIALIZABLE isolation.
          PostgreSQL: BEGIN; UPDATE accounts SET balance = balance - 100 WHERE id = 'A';
                      UPDATE accounts SET balance = balance + 100 WHERE id = 'B'; COMMIT;
          Distributed: Saga pattern or 2-Phase Commit.
```

---

## Best Practices

1. **ALWAYS understand your consistency requirements** before choosing a database — not all data needs strong consistency
2. **ALWAYS use strong consistency for financial data** — money transfers, inventory, bookings
3. **ALWAYS use eventual consistency for counters, metrics, and non-critical reads** — trade consistency for performance
4. **ALWAYS configure write concern and read concern explicitly** — never rely on defaults without understanding them
5. **NEVER assume clocks are synchronized** across distributed nodes — use logical clocks or consensus
6. **NEVER ignore partition tolerance** — network splits WILL happen in production
7. **ALWAYS test failure scenarios** — what happens when a node goes down mid-transaction?
8. **ALWAYS document consistency choices** for each data entity in your system

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Strong consistency for everything | High latency, reduced availability | Use eventual consistency for non-critical data |
| Eventual consistency for financial data | Lost transactions, double-spend | Use ACID transactions, serializable isolation |
| Ignoring CAP during database selection | System goes down during network issues | Evaluate CP vs AP requirements upfront |
| Relying on wall clock for ordering | Silent data loss from clock skew | Use logical clocks, vector clocks, or consensus |
| Not configuring write concern | Data loss during node failure (default w=1) | Set w="majority" for important data |
| Assuming "consistency" means the same thing everywhere | Wrong expectations, production bugs | Learn each database's specific consistency model |
| Single-region deployment claiming "high availability" | Entire region failure takes system down | Multi-region deployment with defined RPO/RTO |
| No conflict resolution strategy | Last-write-wins silently drops writes | Implement application-level merge or use CRDTs |

---

## Real-world Examples

### Google Spanner
- External consistency (stronger than linearizable) using TrueTime API
- GPS-synchronized atomic clocks in every data center
- Globally distributed with ACID transactions
- Tradeoff: higher latency for cross-region transactions (~200ms)

### Amazon DynamoDB
- AP system — prioritizes availability during partitions
- Eventually consistent reads by default (strongly consistent reads available at 2x cost)
- Conditional writes for optimistic concurrency control
- Global tables with multi-region active-active replication

### Apache Cassandra
- Tunable consistency per query (ONE, QUORUM, ALL)
- Last-Write-Wins with wall clock timestamps (client-provided)
- Hinted handoff for temporary node failures
- Anti-entropy repair for long-term consistency

### CockroachDB
- Serializable isolation by default (strongest ACID guarantee)
- Raft consensus for distributed transactions
- Hybrid-logical clocks (HLC) for ordering
- Leaseholder-based reads for low-latency local reads

---

## Enforcement Checklist

- [ ] Consistency model documented for each data entity (strong, eventual, causal)
- [ ] CAP tradeoff understood for chosen database
- [ ] Write concern configured explicitly (not relying on defaults)
- [ ] Read concern configured explicitly for critical reads
- [ ] Conflict resolution strategy defined for multi-writer scenarios
- [ ] Network partition behavior tested and documented
- [ ] Clock synchronization considered (NTP/PTP for distributed systems)
- [ ] Failure scenarios tested (node down, partition, split-brain)
- [ ] Consistency requirements reviewed with product team (not just engineering)
- [ ] Monitoring in place for replication lag and consistency violations
