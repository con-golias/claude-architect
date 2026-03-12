# System Design: Distributed Systems — Complete Specification

> **AI Plugin Directive:** A distributed system is a collection of independent computers that appears as a single system to users. Distributed systems introduce fundamental challenges: partial failure, network unreliability, clock skew, and the impossibility of achieving consistency, availability, and partition tolerance simultaneously. EVERY developer working on distributed systems must understand these challenges and design defensively against them.

---

## 1. The Eight Fallacies of Distributed Computing

```
THESE ARE FALSE ASSUMPTIONS THAT CAUSE BUGS:

1. The network is reliable         → Packets get lost, connections drop
2. Latency is zero                 → Network calls are 1000x slower than local
3. Bandwidth is infinite           → Large payloads cause timeouts
4. The network is secure           → Encrypt everything, validate everything
5. Topology doesn't change         → Servers move, IPs change, routes change
6. There is one administrator      → Multiple teams, multiple cloud accounts
7. Transport cost is zero          → Data transfer costs money, adds latency
8. The network is homogeneous      → Different protocols, versions, configurations

DESIGN IMPLICATION:
  EVERY network call can fail, be slow, or return stale data.
  Design for failure, not for success.
```

---

## 2. Types of Failures

```
CRASH FAILURE:
  Node stops completely (server crash, OOM, hardware failure)
  Detection: Health check timeout
  Recovery: Restart, failover to replica

OMISSION FAILURE:
  Node fails to send or receive messages (network partition, packet loss)
  Detection: Timeout on expected response
  Recovery: Retry with backoff, circuit breaker

TIMING FAILURE:
  Response arrives but too late (slow processing, network congestion)
  Detection: Timeout threshold exceeded
  Recovery: Timeout + fallback, async processing

BYZANTINE FAILURE:
  Node sends incorrect/contradictory responses (bug, corruption, attack)
  Detection: Consensus algorithms, checksums
  Recovery: Redundancy + voting (requires 3f+1 nodes for f failures)
```

---

## 3. Consensus and Coordination

### Leader Election

```typescript
// In distributed systems, one node often acts as the "leader"
// that coordinates writes. If the leader fails, a new one is elected.

// Use existing tools — NEVER build your own consensus:
// - Zookeeper (mature, battle-tested)
// - etcd (Kubernetes uses this)
// - Consul (HashiCorp)
// - Redis Redlock (for simple distributed locks)

// Example: Distributed lock with Redis (Redlock algorithm)
class DistributedLock {
  constructor(private readonly redis: Redis) {}

  async acquire(lockKey: string, ttlMs: number): Promise<string | null> {
    const lockValue = uuid(); // Unique per acquisition attempt
    const result = await this.redis.set(
      `lock:${lockKey}`,
      lockValue,
      'PX', ttlMs,      // Expire after ttlMs
      'NX',             // Only set if not exists
    );
    return result === 'OK' ? lockValue : null;
  }

  async release(lockKey: string, lockValue: string): Promise<boolean> {
    // Only release if we own the lock (compare-and-delete)
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, `lock:${lockKey}`, lockValue);
    return result === 1;
  }
}

// Usage
const lock = new DistributedLock(redis);
const lockValue = await lock.acquire('order-123', 5000);
if (lockValue) {
  try {
    await processOrder('order-123');
  } finally {
    await lock.release('order-123', lockValue);
  }
} else {
  // Another node is processing this order
}
```

### Consistency Models

```
STRONG CONSISTENCY:
  After a write, ALL subsequent reads see the write.
  Achieved by: Single leader with synchronous replication
  Trade-off: Higher latency, lower availability during partition
  Use for: Financial transactions, inventory counts

EVENTUAL CONSISTENCY:
  After a write, reads MAY see stale data temporarily.
  Eventually, all reads will see the latest write.
  Trade-off: Stale reads possible, but higher availability
  Use for: Social media feeds, product reviews, analytics

CAUSAL CONSISTENCY:
  If A causes B, everyone sees A before B.
  Unrelated writes may be seen in any order.
  Trade-off: Moderate latency, preserves causality
  Use for: Chat messages, collaborative editing

READ-YOUR-WRITES:
  After you write, YOUR reads see the write.
  Other users may see stale data.
  Trade-off: Good user experience with scalability
  Use for: User profile updates, shopping cart
```

---

## 4. Replication Patterns

```
SINGLE-LEADER (Primary-Replica):
  One node accepts writes → replicates to followers
  Followers serve reads

  ┌──────────┐    sync/async    ┌──────────┐
  │ Primary  │────────────────►│ Replica 1│
  │ (writes) │                  └──────────┘
  │          │────────────────►┌──────────┐
  └──────────┘                  │ Replica 2│
                                └──────────┘

  Pro: Simple, strong consistency possible
  Con: Single point of failure for writes (need failover)
  Use: PostgreSQL, MySQL, MongoDB (default)

MULTI-LEADER:
  Multiple nodes accept writes → replicate to each other

  ┌──────────┐◄───────────────►┌──────────┐
  │ Leader 1 │                  │ Leader 2 │
  │ (Region A)│                  │ (Region B)│
  └──────────┘                  └──────────┘

  Pro: Write availability in multiple regions
  Con: Write conflicts must be resolved
  Use: CouchDB, multi-region active-active setups

LEADERLESS (Quorum):
  Writes go to W nodes, reads from R nodes
  Consistency if W + R > N (total nodes)

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Node 1   │  │ Node 2   │  │ Node 3   │
  │ (read +  │  │ (read +  │  │ (read +  │
  │  write)  │  │  write)  │  │  write)  │
  └──────────┘  └──────────┘  └──────────┘

  Pro: No single point of failure
  Con: Complex conflict resolution, tunable consistency
  Use: Cassandra, DynamoDB, Riak
```

---

## 5. Partitioning (Sharding)

```typescript
// When one database can't hold all data or handle all traffic

// RANGE PARTITIONING:
// Partition by value range (e.g., date, alphabetical)
// Pro: Range queries efficient
// Con: Hot partitions if range is uneven

// HASH PARTITIONING:
// Partition by hash of key
// Pro: Even distribution
// Con: Range queries require scatter-gather

// CONSISTENT HASHING:
// Nodes placed on a hash ring
// Each key maps to the nearest node clockwise
// Pro: Adding/removing nodes moves minimal data
// Con: Non-uniform distribution without virtual nodes

function getPartition(key: string, numPartitions: number): number {
  // Simple hash partitioning
  const hash = crypto.createHash('md5').update(key).digest('hex');
  const numericHash = parseInt(hash.substring(0, 8), 16);
  return numericHash % numPartitions;
}

// Example: Shard orders by customer ID
function getOrderShard(customerId: string): DatabaseConnection {
  const shardIndex = getPartition(customerId, NUM_SHARDS);
  return shardConnections[shardIndex];
}
```

---

## 6. Time and Ordering

```
PROBLEM: Clocks on different machines are NOT synchronized perfectly.
  Machine A thinks it's 10:00:00.000
  Machine B thinks it's 10:00:00.150 (150ms off)
  Who wrote first? UNKNOWN without special techniques.

SOLUTIONS:

1. LOGICAL CLOCKS (Lamport Timestamps):
   Each event gets a monotonically increasing counter.
   If A happens before B in causal order, counter(A) < counter(B).
   Cannot determine wall-clock time, only ordering.

2. VECTOR CLOCKS:
   Each node maintains a vector of counters (one per node).
   Can detect CONCURRENT events (no causal relationship).
   Used by: Dynamo, Riak for conflict detection.

3. HYBRID LOGICAL CLOCKS (HLC):
   Combines physical time with logical counter.
   Better than Lamport (includes wall-clock) but handles skew.
   Used by: CockroachDB, YugabyteDB.

PRACTICAL RULE:
  For most applications: Use database-generated timestamps
  (the database is the single source of truth for ordering).
  For multi-database/multi-region: Use HLC or Spanner TrueTime.
  NEVER rely on application server clocks for ordering.
```

---

## 7. Failure Handling Patterns

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableErrors?: string[];
  },
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (options.retryableErrors && !options.retryableErrors.includes(lastError.name)) {
        throw lastError;
      }

      if (attempt === options.maxRetries) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        options.maxDelayMs,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage
const result = await retryWithBackoff(
  () => httpClient.get('https://api.example.com/data'),
  { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 },
);
```

### Bulkhead Pattern

```typescript
// Isolate failures to prevent cascade
// If the payment service is slow, it shouldn't slow down product listing

class BulkheadExecutor {
  private activeCalls: number = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize: number,
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeCalls >= this.maxConcurrent) {
      throw new BulkheadRejectedError(
        `Max concurrent calls (${this.maxConcurrent}) reached`,
      );
    }

    this.activeCalls++;
    try {
      return await operation();
    } finally {
      this.activeCalls--;
    }
  }
}

// Separate bulkheads per dependency
const paymentBulkhead = new BulkheadExecutor(10, 50);   // Max 10 concurrent payment calls
const catalogBulkhead = new BulkheadExecutor(50, 200);   // Max 50 concurrent catalog calls
const emailBulkhead = new BulkheadExecutor(20, 100);     // Max 20 concurrent email calls
```

---

## 8. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Assuming Network Reliability** | No timeout, no retry, no fallback | Timeout + retry + circuit breaker on every call |
| **Distributed Monolith** | Services that must deploy together | Decouple via events, own data |
| **Two-Phase Commit** | Distributed transactions across services | Saga pattern with compensation |
| **Synchronous Everywhere** | All calls are request-response | Default to async events, sync only when needed |
| **No Idempotency** | Retry creates duplicates | Idempotency keys on all mutations |
| **Trusting Clocks** | Using wall-clock for ordering across nodes | Logical clocks or database ordering |
| **No Backpressure** | Producer overwhelms consumer | Queue-based buffering, rate limiting |
| **Split Brain** | Two leaders in a replicated system | Fencing tokens, proper leader election |

---

## 9. Enforcement Checklist

- [ ] **Every network call has a timeout** — never wait forever
- [ ] **Retry with exponential backoff and jitter** — on all retryable operations
- [ ] **Circuit breakers on external dependencies** — prevent cascading failure
- [ ] **Idempotent operations** — safe to retry without side effects
- [ ] **Async by default** — synchronous only when immediate response is required
- [ ] **Data replicated for availability** — single points of failure eliminated
- [ ] **Partitioning strategy defined** — for data that exceeds single-node capacity
- [ ] **Monitoring for partial failures** — detect when part of the system is degraded
- [ ] **Consistency model documented** — strong, eventual, or causal per data type
- [ ] **Fallback behavior defined** — what happens when each dependency is unavailable
