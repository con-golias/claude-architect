# CAP Theorem — Complete Specification

> **AI Plugin Directive:** The CAP theorem states that a distributed system can provide AT MOST two of three guarantees: Consistency, Availability, and Partition Tolerance. Since network partitions are UNAVOIDABLE in distributed systems, the REAL choice is between Consistency and Availability during a partition. This is not a binary choice — it is a SPECTRUM per operation. Different operations in the same system can make different trade-offs.

---

## 1. The Three Properties

```
C — CONSISTENCY:
  Every read receives the most recent write or an error.
  All nodes see the same data at the same time.
  NOT the same as ACID consistency (that's about invariants).

A — AVAILABILITY:
  Every request receives a non-error response.
  The system continues to function even if some nodes are down.
  Does NOT guarantee the response contains the latest data.

P — PARTITION TOLERANCE:
  The system continues to operate despite network partitions
  (messages between nodes are dropped or delayed).
  In a distributed system, partitions WILL happen.

THE THEOREM:
  You can have at most 2 of 3.
  Since P is mandatory (networks fail), you choose between C and A.

  CP: Consistent + Partition Tolerant
      → During partition: refuse requests to maintain consistency
      → Example: Banking transfers, inventory reservations

  AP: Available + Partition Tolerant
      → During partition: serve possibly stale data to maintain availability
      → Example: Social media feeds, product recommendations

  CA: Consistent + Available (NO partition tolerance)
      → Only possible on single-node systems (not distributed)
      → Not relevant for distributed systems
```

---

## 2. The Real Choice: C vs A per Operation

```
IT IS NOT "PICK ONE FOR THE WHOLE SYSTEM."
Different operations have different requirements:

E-Commerce Example:
  ┌──────────────────────┬─────────┬───────────────────────────────┐
  │ Operation            │ Choice  │ Rationale                     │
  ├──────────────────────┼─────────┼───────────────────────────────┤
  │ Account balance      │ CP      │ Must be accurate for debits   │
  │ Inventory count      │ CP      │ Overselling is a business loss│
  │ Order placement      │ CP      │ Payment must be consistent    │
  │ Product listing      │ AP      │ Stale catalog is acceptable   │
  │ Product reviews      │ AP      │ Missing recent review is OK   │
  │ Search results       │ AP      │ Slightly stale results are OK │
  │ User session         │ AP      │ Prefer availability over      │
  │                      │         │ session consistency            │
  │ Shopping cart         │ AP      │ Merge conflicts on reunion    │
  └──────────────────────┴─────────┴───────────────────────────────┘
```

---

## 3. Database Classification

```
CP DATABASES (Prefer Consistency):
  PostgreSQL (single primary)     — Rejects writes if replica is unreachable
  MySQL (single primary)          — Same as PostgreSQL
  MongoDB (default config)        — Primary must acknowledge writes
  Zookeeper                       — Consensus-based, rejects during partition
  etcd                            — Raft consensus, majority required
  CockroachDB                     — Serializable distributed transactions
  Google Spanner                  — TrueTime for global consistency

AP DATABASES (Prefer Availability):
  Cassandra                       — Tunable consistency, AP by default
  DynamoDB (eventual consistency) — Available in all regions
  CouchDB                         — Multi-master, eventual consistency
  Riak                            — Leaderless, tunable W/R quorum
  Redis Cluster                   — Asynchronous replication

TUNABLE DATABASES (Choose per query):
  Cassandra:  CONSISTENCY ONE (AP) vs CONSISTENCY QUORUM (CP)
  DynamoDB:   Eventually consistent reads (AP) vs Strongly consistent reads (CP)
  MongoDB:    Read concern "local" (AP) vs "majority" (CP)
```

---

## 4. Practical Implications

### CP System Behavior During Partition

```typescript
// During a network partition, a CP system REJECTS requests
// to maintain consistency

// Example: Inventory service (CP choice)
class InventoryService {
  async reserveStock(productId: string, quantity: number): Promise<ReservationResult> {
    try {
      // Requires quorum write (majority of replicas must confirm)
      const result = await this.db.query(
        `UPDATE inventory SET reserved = reserved + $1
         WHERE product_id = $2 AND (stock - reserved) >= $1`,
        [quantity, productId],
      );

      if (result.rowCount === 0) {
        return { success: false, reason: 'INSUFFICIENT_STOCK' };
      }
      return { success: true };

    } catch (error) {
      if (error.code === 'PARTITION_ERROR' || error.code === 'QUORUM_NOT_MET') {
        // CP: Refuse the request rather than risk inconsistency
        return { success: false, reason: 'SERVICE_UNAVAILABLE' };
        // The caller can retry later or show "try again" to user
      }
      throw error;
    }
  }
}
```

### AP System Behavior During Partition

```typescript
// During a network partition, an AP system SERVES requests
// with potentially stale data

// Example: Product catalog (AP choice)
class CatalogService {
  async getProduct(productId: string): Promise<Product> {
    try {
      // Try primary first
      return await this.primaryDb.getProduct(productId);
    } catch (error) {
      if (isPartitionError(error)) {
        // AP: Serve from local replica/cache even if stale
        const cached = await this.localCache.get(productId);
        if (cached) {
          return { ...cached, _stale: true }; // Flag as potentially stale
        }
        // Last resort: serve from read replica
        return await this.readReplica.getProduct(productId);
      }
      throw error;
    }
  }
}
```

---

## 5. PACELC Extension

```
CAP only describes behavior DURING partitions.
PACELC extends it to also describe behavior during NORMAL operation.

PACELC: If Partition → {Consistency or Availability}
        Else (no partition) → {Latency or Consistency}

During partition: Choose C or A (same as CAP)
During normal:    Choose L (low latency) or C (strong consistency)

PA/EL: Available during partition, Low latency normally
  → DynamoDB (eventual consistency), Cassandra (ONE)
  → Best for: Social media, content delivery, analytics

PC/EC: Consistent during partition, Consistent normally
  → PostgreSQL (synchronous replication), Spanner
  → Best for: Banking, inventory, booking systems

PA/EC: Available during partition, Consistent normally
  → MongoDB (default), most RDBMS with async replication
  → Best for: Most web applications (consistency usually, availability in crisis)

PC/EL: Consistent during partition, Low latency normally
  → Rare in practice — PAXOS/Raft based systems with optimized reads
```

---

## 6. Decision Guide

```
For EACH piece of data in your system, ask:

1. What happens if a user reads stale data?
   → Financial loss, legal issue, safety risk → CP (strong consistency)
   → Minor inconvenience, UI glitch → AP (eventual consistency)

2. What happens if the system is unavailable?
   → Users can wait/retry → CP is acceptable
   → Users leave permanently → AP is necessary

3. Is this data shared across regions?
   → Single region → Strong consistency is cheap
   → Multi-region → Strong consistency adds latency (trade-off)

COMMON DECISIONS:
  User authentication → CP (wrong auth = security breach)
  Account balance → CP (wrong balance = financial error)
  Inventory reservation → CP (overselling = business loss)
  Product catalog → AP (stale product info = minor issue)
  Social media feed → AP (missing a post = acceptable)
  Search results → AP (stale index = acceptable)
  Shopping cart → AP (merge on reunion)
  Configuration → CP (wrong config = system error)
```

---

## 7. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **One-size-fits-all** | Same consistency for everything | Choose per data type / operation |
| **Ignoring Partitions** | "Our network never fails" | Network WILL fail. Design for it. |
| **Strong Consistency Everywhere** | CP for everything → poor availability | AP for non-critical data |
| **Eventual Consistency Everywhere** | AP for everything → data bugs | CP for critical transactions |
| **Not Communicating Staleness** | User sees stale data without knowing | Flag stale data in UI |
| **No Conflict Resolution** | AP system with no merge strategy | Last-write-wins, merge, or CRDTs |

---

## 8. Enforcement Checklist

- [ ] **Per-operation consistency documented** — each data type classified as CP or AP
- [ ] **Database matches requirements** — CP database for CP data, AP database for AP data
- [ ] **Partition behavior defined** — what happens to each operation during network partition
- [ ] **Staleness communicated** — UI shows when data may be stale
- [ ] **Conflict resolution strategy** — for AP data that may have concurrent writes
- [ ] **Fallback behavior** — what CP operations do when unavailable (retry, queue, error)
- [ ] **Multi-region trade-offs explicit** — latency vs consistency for cross-region data
