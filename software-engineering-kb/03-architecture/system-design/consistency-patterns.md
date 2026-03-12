# System Design: Consistency Patterns — Complete Specification

> **AI Plugin Directive:** Consistency in distributed systems is NOT a single property — it is a SPECTRUM of guarantees that trade off against availability, latency, and complexity. Choose the WEAKEST consistency model that satisfies your business requirements. Strong consistency everywhere kills performance and availability. Eventual consistency everywhere creates data bugs. The correct approach is to classify EACH piece of data and choose the appropriate consistency model per operation.

---

## 1. The Consistency Spectrum

```
STRONGEST ──────────────────────────────────────────────── WEAKEST

Linearizability → Sequential → Causal → Read-your-writes → Monotonic → Eventual

┌─────────────────────┬────────────────────────────────────────────────────┐
│ Model               │ Guarantee                                          │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Linearizability     │ All ops appear to happen at a single point in time │
│                     │ Real-time ordering preserved across ALL clients     │
│                     │ Most expensive. Requires consensus (Paxos/Raft).   │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Sequential          │ All clients see ops in the SAME order              │
│                     │ Order may differ from real-time wall clock          │
│                     │ Cheaper than linearizable. Single-leader systems.   │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Causal              │ If A causes B, everyone sees A before B            │
│                     │ Concurrent (unrelated) ops may appear in any order │
│                     │ Good balance of correctness and performance.        │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Read-your-writes    │ After you write, YOUR subsequent reads see it      │
│                     │ Other users may see stale data                      │
│                     │ Essential for good user experience.                 │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Monotonic reads     │ Once you read a value, you never see an older one  │
│                     │ Prevents "time travel" for a single client          │
│                     │ Minimum for sane user experience.                   │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Eventual            │ If no new writes, all replicas converge eventually  │
│                     │ No ordering guarantees during convergence           │
│                     │ Cheapest. Highest availability. Risk of stale reads.│
└─────────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. Strong Consistency Patterns

### 2.1 Synchronous Replication

```
Write must be confirmed by ALL (or majority of) replicas before acknowledging.

  Client → Primary → Replica 1 (ACK) ─┐
                   → Replica 2 (ACK) ─┤→ All ACKs received → Client ACK
                   → Replica 3 (ACK) ─┘

RULES:
  - Use for data where stale reads cause financial/legal/safety harm
  - Accept higher write latency (wait for replica ACKs)
  - Accept lower availability during partition (can't write if replicas unreachable)
  - ALWAYS set a timeout on replication — don't wait forever for slow replicas

IMPLEMENTATION:
  PostgreSQL:  synchronous_commit = on + synchronous_standby_names
  MySQL:       Semi-synchronous replication (at least 1 replica ACKs)
  MongoDB:     writeConcern: { w: "majority" }
  Cassandra:   CONSISTENCY ALL or QUORUM
```

```typescript
// Strong consistency write — wait for quorum
class StrongConsistencyRepository {
  async transferFunds(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
  ): Promise<TransferResult> {
    // Use serializable isolation — strongest guarantee
    return await this.db.transaction(async (tx) => {
      // Lock both accounts to prevent concurrent modifications
      const fromAccount = await tx.query(
        `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`,
        [fromAccountId],
      );
      const toAccount = await tx.query(
        `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`,
        [toAccountId],
      );

      if (fromAccount.balance < amount) {
        throw new InsufficientFundsError();
      }

      await tx.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [amount, fromAccountId],
      );
      await tx.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [amount, toAccountId],
      );

      // Transaction commits with synchronous replication
      // Primary waits for replica confirmation before returning
      return { success: true, newBalance: fromAccount.balance - amount };
    }, { isolationLevel: 'SERIALIZABLE' });
  }
}
```

### 2.2 Consensus Protocols

```
WHEN TO USE CONSENSUS:
  - Leader election (who is the primary?)
  - Distributed locks (who holds the lock?)
  - Configuration management (what's the current config?)
  - Sequence generation (what's the next ID?)

NEVER build your own consensus protocol.
Use: etcd (Raft), Zookeeper (ZAB), Consul (Raft).

RAFT SIMPLIFIED:
  1. One node is elected LEADER
  2. All writes go through the leader
  3. Leader replicates to followers
  4. Write is committed when MAJORITY (N/2 + 1) of nodes acknowledge
  5. If leader fails, followers elect a new leader (election timeout)

  Cluster of 3: tolerates 1 failure (need 2 of 3)
  Cluster of 5: tolerates 2 failures (need 3 of 5)
  Cluster of 7: tolerates 3 failures (need 4 of 7)

RULE: Always use ODD number of nodes for consensus clusters.
  Even numbers waste resources (4 nodes still only tolerates 1 failure, same as 3).
```

### 2.3 Two-Phase Commit (2PC)

```
USE WITH EXTREME CAUTION. 2PC is a blocking protocol.

Phase 1 — PREPARE:
  Coordinator → All participants: "Can you commit?"
  Each participant: Writes to WAL, locks resources, votes YES or NO

Phase 2 — COMMIT/ABORT:
  If ALL vote YES → Coordinator: "COMMIT"
  If ANY votes NO → Coordinator: "ABORT"

PROBLEMS:
  - BLOCKING: If coordinator crashes between phases, participants are stuck
  - LATENCY: Two round trips minimum
  - AVAILABILITY: Any participant failure blocks the entire transaction
  - DOES NOT SCALE: Lock duration grows with number of participants

WHEN TO USE:
  - Within a SINGLE database (internal 2PC is well-tested)
  - Between 2-3 tightly coupled databases in same datacenter
  - NEVER across microservices (use Saga pattern instead)

ALTERNATIVES:
  - Saga pattern (compensating transactions)
  - Outbox pattern (reliable event publishing)
  - TCC (Try-Confirm-Cancel)
```

```typescript
// Two-Phase Commit — only for same-datacenter, 2-3 databases
// NEVER use across microservices or across regions
class TwoPhaseCommitCoordinator {
  async executeTransaction(
    participants: TransactionParticipant[],
    operation: TransactionOperation,
  ): Promise<boolean> {
    const transactionId = uuid();

    // Phase 1: PREPARE
    const votes: boolean[] = [];
    for (const participant of participants) {
      try {
        const vote = await withTimeout(
          participant.prepare(transactionId, operation),
          5000, // 5 second timeout — don't block forever
        );
        votes.push(vote);
      } catch (error) {
        votes.push(false); // Timeout or error = NO vote
      }
    }

    // Phase 2: COMMIT or ABORT
    const allVotedYes = votes.every(v => v === true);

    if (allVotedYes) {
      // All said yes — commit
      await Promise.all(
        participants.map(p =>
          p.commit(transactionId).catch(err => {
            // Log and retry — participant MUST eventually commit after voting YES
            this.scheduleRetry(p, transactionId, 'commit');
          })
        ),
      );
      return true;
    } else {
      // At least one said no — abort all
      await Promise.all(
        participants.map(p =>
          p.abort(transactionId).catch(err => {
            this.scheduleRetry(p, transactionId, 'abort');
          })
        ),
      );
      return false;
    }
  }
}
```

---

## 3. Eventual Consistency Patterns

### 3.1 Last-Write-Wins (LWW)

```
SIMPLEST conflict resolution. Highest timestamp wins.

RULES:
  - Use synchronized clocks (NTP) or logical timestamps
  - Accept that concurrent writes may be silently lost
  - ONLY suitable when data loss from concurrent writes is acceptable

GOOD FOR:
  - User preferences (last saved value wins)
  - Session data (latest session state)
  - Cached values (will be refreshed anyway)

BAD FOR:
  - Counters (increments would be lost)
  - Shopping carts (items would disappear)
  - Collaborative editing (changes would vanish)

IMPLEMENTATION:
  Cassandra uses LWW by default.
  DynamoDB uses LWW for concurrent writes to same item.
```

```typescript
// Last-Write-Wins with timestamp
class LWWRegister<T> {
  private value: T;
  private timestamp: number;

  constructor(initialValue: T) {
    this.value = initialValue;
    this.timestamp = Date.now();
  }

  write(newValue: T, timestamp: number): void {
    // Only accept if newer than current
    if (timestamp > this.timestamp) {
      this.value = newValue;
      this.timestamp = timestamp;
    }
    // Silently ignore older writes — this IS the trade-off
  }

  read(): T {
    return this.value;
  }

  merge(other: LWWRegister<T>): LWWRegister<T> {
    // Deterministic merge — higher timestamp wins
    if (other.timestamp > this.timestamp) {
      return other;
    }
    return this;
  }
}
```

### 3.2 Conflict-Free Replicated Data Types (CRDTs)

```
CRDTs are data structures that can be MERGED automatically without conflicts.
All replicas converge to the same state regardless of message ordering.

TYPES:

G-Counter (Grow-only Counter):
  Each node has its own counter. Total = sum of all.
  Node A: {A: 5, B: 0}  →  Node B: {A: 0, B: 3}
  Merge: {A: 5, B: 3} → Total = 8
  Use: Page views, like counts, analytics counters

PN-Counter (Positive-Negative Counter):
  Two G-Counters: one for increments, one for decrements.
  Value = sum(increments) - sum(decrements)
  Use: Stock levels, upvote/downvote counts

G-Set (Grow-only Set):
  Elements can only be ADDED, never removed.
  Merge = union of both sets.
  Use: Tag collections, seen-message sets

OR-Set (Observed-Remove Set):
  Elements can be added AND removed.
  Each add gets a unique tag. Remove only removes observed tags.
  Use: Shopping carts, friend lists, collaborative collections

LWW-Register:
  Single value with timestamp. Latest timestamp wins.
  Use: User profile fields, configuration values

LWW-Map:
  Map where each key is an LWW-Register.
  Use: User settings, feature flags per user
```

```typescript
// G-Counter CRDT — grow-only distributed counter
class GCounter {
  // Each node tracks its OWN increments only
  private counters: Map<string, number> = new Map();

  constructor(private readonly nodeId: string) {
    this.counters.set(nodeId, 0);
  }

  increment(amount: number = 1): void {
    // Only increment YOUR OWN counter
    const current = this.counters.get(this.nodeId) || 0;
    this.counters.set(this.nodeId, current + amount);
  }

  value(): number {
    // Total is the sum of ALL node counters
    let total = 0;
    for (const count of this.counters.values()) {
      total += count;
    }
    return total;
  }

  merge(other: GCounter): void {
    // Take the MAX of each node's counter
    for (const [nodeId, count] of other.counters) {
      const current = this.counters.get(nodeId) || 0;
      this.counters.set(nodeId, Math.max(current, count));
    }
  }

  state(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}

// OR-Set CRDT — add and remove elements safely
class ORSet<T> {
  // Each element has unique tags (one per add operation)
  private elements: Map<string, Set<string>> = new Map(); // value → set of tags
  private tombstones: Set<string> = new Set(); // removed tags

  constructor(private readonly nodeId: string) {}

  add(value: T): void {
    const tag = `${this.nodeId}:${uuid()}`;
    const key = JSON.stringify(value);
    if (!this.elements.has(key)) {
      this.elements.set(key, new Set());
    }
    this.elements.get(key)!.add(tag);
  }

  remove(value: T): void {
    const key = JSON.stringify(value);
    const tags = this.elements.get(key);
    if (tags) {
      // Only remove tags we've OBSERVED (not future concurrent adds)
      for (const tag of tags) {
        this.tombstones.add(tag);
      }
      this.elements.delete(key);
    }
  }

  has(value: T): boolean {
    const key = JSON.stringify(value);
    const tags = this.elements.get(key);
    if (!tags) return false;
    // Element exists if it has any non-tombstoned tags
    for (const tag of tags) {
      if (!this.tombstones.has(tag)) return true;
    }
    return false;
  }

  merge(other: ORSet<T>): void {
    // Union all tags, union all tombstones
    for (const [key, tags] of other.elements) {
      if (!this.elements.has(key)) {
        this.elements.set(key, new Set());
      }
      for (const tag of tags) {
        this.elements.get(key)!.add(tag);
      }
    }
    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
    }
    // Clean up: remove elements where all tags are tombstoned
    for (const [key, tags] of this.elements) {
      for (const tag of tags) {
        if (this.tombstones.has(tag)) {
          tags.delete(tag);
        }
      }
      if (tags.size === 0) {
        this.elements.delete(key);
      }
    }
  }
}
```

### 3.3 Read Repair and Anti-Entropy

```
READ REPAIR:
  During a read, if replicas disagree, update the stale replicas.
  Fixes inconsistencies lazily (only when data is read).

  Client reads from 3 replicas:
    Replica A: version 5 ← STALE
    Replica B: version 7 ← LATEST
    Replica C: version 7 ← LATEST

  Return version 7 to client.
  Background: Send version 7 to Replica A.

  Used by: Cassandra, DynamoDB, Riak

ANTI-ENTROPY (Merkle Trees):
  Background process that compares ALL data between replicas.
  Uses Merkle trees (hash trees) for efficient comparison.
  Finds and fixes ALL inconsistencies, not just read ones.

  1. Each replica builds a Merkle tree over its data
  2. Compare root hashes — if equal, replicas are consistent
  3. If different, traverse tree to find divergent branches
  4. Only transfer the divergent data

  Used by: Cassandra (nodetool repair), DynamoDB, Riak

RULE: Use BOTH read repair AND anti-entropy.
  Read repair fixes hot data quickly.
  Anti-entropy fixes cold data that's rarely read.
```

---

## 4. Session Consistency Patterns

### 4.1 Read-Your-Writes

```
PROBLEM:
  User updates profile name → page refreshes → sees OLD name.
  Write went to primary, read came from stale replica.

SOLUTIONS:

1. STICKY SESSIONS (simplest):
   Route user's reads to the replica that received their write.
   Implementation: Cookie or header with last-write replica ID.
   Con: Breaks if that replica goes down.

2. READ FROM PRIMARY AFTER WRITE:
   After a write, read from primary for N seconds.
   Then fall back to replicas.
   Implementation: Track last-write timestamp per user.

3. CAUSAL TOKENS:
   Write returns a token (LSN or timestamp).
   Subsequent reads include the token.
   Replica only serves if it's caught up to that token.
```

```typescript
// Read-your-writes with causal token
class ReadYourWritesRepository {
  constructor(
    private readonly primary: Database,
    private readonly replicas: Database[],
  ) {}

  async write(query: string, params: any[]): Promise<WriteResult> {
    const result = await this.primary.query(query, params);
    // Return a causal token (the write's log sequence number)
    return {
      ...result,
      causalToken: result.lastLSN, // Log Sequence Number
    };
  }

  async read(
    query: string,
    params: any[],
    causalToken?: string,
  ): Promise<ReadResult> {
    if (causalToken) {
      // Try to find a replica that's caught up to the causal token
      for (const replica of this.replicas) {
        const replicaLSN = await replica.getCurrentLSN();
        if (replicaLSN >= causalToken) {
          return await replica.query(query, params);
        }
      }
      // No replica is caught up — fall back to primary
      return await this.primary.query(query, params);
    }

    // No causal token — any replica is fine
    const replica = this.replicas[Math.floor(Math.random() * this.replicas.length)];
    return await replica.query(query, params);
  }
}

// Usage in API layer
class UserProfileController {
  async updateProfile(req: Request, res: Response): Promise<void> {
    const result = await this.repo.write(
      'UPDATE users SET name = $1 WHERE id = $2',
      [req.body.name, req.user.id],
    );

    // Store causal token in session/cookie
    req.session.lastWriteToken = result.causalToken;

    res.json({ success: true });
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    // Pass causal token to ensure read-your-writes
    const profile = await this.repo.read(
      'SELECT * FROM users WHERE id = $1',
      [req.params.id],
      req.session.lastWriteToken, // undefined if no recent write
    );

    res.json(profile);
  }
}
```

### 4.2 Monotonic Reads

```
PROBLEM:
  User refreshes page → sees 10 comments.
  Refreshes again → sees 8 comments (hit a more stale replica).
  Refreshes again → sees 10 comments again.
  Data appears to "time travel."

SOLUTION:
  Once a client reads from a replica at version X,
  all subsequent reads must come from replicas at version >= X.

IMPLEMENTATION:
  1. Track the highest version/LSN seen by each client
  2. Only route reads to replicas at or beyond that version
  3. If no replica qualifies, read from primary

RULE: Monotonic reads is the MINIMUM consistency for any user-facing system.
  Without it, users see data going backwards, which destroys trust.
```

```typescript
// Monotonic reads middleware
class MonotonicReadRouter {
  // Track last-seen version per client session
  private sessionVersions: Map<string, string> = new Map();

  constructor(
    private readonly primary: Database,
    private readonly replicas: Database[],
  ) {}

  async read(
    sessionId: string,
    query: string,
    params: any[],
  ): Promise<any> {
    const minimumVersion = this.sessionVersions.get(sessionId);

    // Find a replica that meets our minimum version requirement
    const eligible = [];
    for (const replica of this.replicas) {
      const version = await replica.getCurrentLSN();
      if (!minimumVersion || version >= minimumVersion) {
        eligible.push({ replica, version });
      }
    }

    let result: any;
    let resultVersion: string;

    if (eligible.length > 0) {
      // Pick random eligible replica for load distribution
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];
      result = await chosen.replica.query(query, params);
      resultVersion = chosen.version;
    } else {
      // No replica meets requirement — use primary
      result = await this.primary.query(query, params);
      resultVersion = await this.primary.getCurrentLSN();
    }

    // Update session's minimum version (only advance, never go back)
    if (!minimumVersion || resultVersion > minimumVersion) {
      this.sessionVersions.set(sessionId, resultVersion);
    }

    return result;
  }
}
```

---

## 5. Conflict Resolution Strategies

```
When concurrent writes happen (especially in AP/multi-leader systems),
conflicts MUST be resolved. There is NO automatic "right answer."

STRATEGIES:

1. LAST-WRITE-WINS (LWW):
   Highest timestamp wins. Simple. Concurrent writes silently lost.
   Use for: Non-critical data (preferences, sessions, caches)

2. APPLICATION-LEVEL MERGE:
   Application defines custom merge logic per data type.
   Example: Shopping cart → union of items from both versions.
   Use for: Domain-specific data where merge logic is clear.

3. MANUAL CONFLICT RESOLUTION:
   Store both versions. Show conflict to user. User picks winner.
   Example: Google Docs conflict dialog, Git merge conflicts.
   Use for: Collaborative editing, any data where automated merge is unsafe.

4. CRDTs:
   Data structure that merges automatically by mathematical properties.
   No conflicts possible — all states converge.
   Use for: Counters, sets, maps where convergence is guaranteed.

5. OPERATIONAL TRANSFORM (OT):
   Transform concurrent operations to produce consistent result.
   Complex. Used by Google Docs.
   Use for: Real-time collaborative text editing.

DECISION:
  Can you tolerate losing a write? → LWW
  Can you define merge rules? → Application merge or CRDTs
  Is it user-generated content? → Manual resolution
  Is it real-time collaboration? → OT or CRDTs
```

```typescript
// Application-level merge — shopping cart example
class ShoppingCartMerger {
  merge(local: CartItem[], remote: CartItem[]): CartItem[] {
    const merged = new Map<string, CartItem>();

    // Add all local items
    for (const item of local) {
      merged.set(item.productId, { ...item });
    }

    // Merge remote items
    for (const item of remote) {
      const existing = merged.get(item.productId);
      if (existing) {
        // Same product in both → take the MAX quantity
        // (user intended to have at least this many)
        existing.quantity = Math.max(existing.quantity, item.quantity);
        // Take the latest modification timestamp
        existing.updatedAt = new Date(
          Math.max(existing.updatedAt.getTime(), item.updatedAt.getTime()),
        );
      } else {
        // Product only in remote → add it
        merged.set(item.productId, { ...item });
      }
    }

    return Array.from(merged.values());
  }
}

// Version vector for conflict detection
class VersionVector {
  private versions: Map<string, number> = new Map();

  increment(nodeId: string): void {
    const current = this.versions.get(nodeId) || 0;
    this.versions.set(nodeId, current + 1);
  }

  // Detect relationship between two version vectors
  compare(other: VersionVector): 'before' | 'after' | 'concurrent' {
    let thisNewer = false;
    let otherNewer = false;

    const allNodes = new Set([...this.versions.keys(), ...other.versions.keys()]);

    for (const node of allNodes) {
      const thisV = this.versions.get(node) || 0;
      const otherV = other.versions.get(node) || 0;

      if (thisV > otherV) thisNewer = true;
      if (otherV > thisV) otherNewer = true;
    }

    if (thisNewer && !otherNewer) return 'after';   // this happened after other
    if (otherNewer && !thisNewer) return 'before';  // this happened before other
    return 'concurrent'; // CONFLICT — neither dominates
  }
}
```

---

## 6. Quorum Systems

```
Quorum ensures consistency by requiring a minimum number of nodes to agree.

N = total number of replicas
W = number of nodes that must acknowledge a WRITE
R = number of nodes that must respond to a READ

RULES:
  W + R > N  → Strong consistency (read always sees latest write)
  W + R ≤ N  → Eventual consistency (reads may be stale)

COMMON CONFIGURATIONS:

  N=3, W=2, R=2 (QUORUM):
    Write needs 2/3, Read needs 2/3
    At least 1 node overlaps → guaranteed to see latest write
    Tolerates 1 node failure for both reads and writes
    MOST COMMON choice.

  N=3, W=3, R=1 (WRITE-ALL, READ-ONE):
    Every write goes to all nodes
    Reads from any single node are consistent
    Fast reads, slow writes. Write fails if ANY node is down.
    Use for: Read-heavy workloads where availability during write is less critical.

  N=3, W=1, R=3 (WRITE-ONE, READ-ALL):
    Fastest possible writes
    Reads must query all nodes and take latest
    Write always succeeds if any node is up.
    Use for: Write-heavy workloads, analytics ingestion.

  N=3, W=1, R=1 (EVENTUAL):
    Fastest reads AND writes
    No consistency guarantee
    Use for: Non-critical data, caching, analytics.

SLOPPY QUORUM:
  If the required W nodes are unreachable, write to OTHER available nodes.
  Those nodes "hand off" the data when original nodes come back.
  Increases availability at the cost of consistency.
  Used by: DynamoDB, Riak (hinted handoff).
```

```typescript
// Quorum-based distributed store
class QuorumStore<T> {
  constructor(
    private readonly nodes: StorageNode<T>[],
    private readonly writeQuorum: number, // W
    private readonly readQuorum: number,  // R
  ) {
    // Validate quorum configuration
    const N = nodes.length;
    if (writeQuorum + readQuorum <= N) {
      console.warn(
        `W(${writeQuorum}) + R(${readQuorum}) <= N(${N}): ` +
        `No strong consistency guarantee. Reads may return stale data.`,
      );
    }
  }

  async write(key: string, value: T, version: number): Promise<boolean> {
    const results = await Promise.allSettled(
      this.nodes.map(node => node.put(key, value, version)),
    );

    const successes = results.filter(r => r.status === 'fulfilled').length;

    if (successes >= this.writeQuorum) {
      return true; // Write quorum met
    }

    // Quorum not met — rollback successful writes
    // (or accept the partial write and rely on read repair)
    throw new QuorumNotMetError(
      `Only ${successes}/${this.writeQuorum} nodes acknowledged write`,
    );
  }

  async read(key: string): Promise<T | null> {
    const results = await Promise.allSettled(
      this.nodes.map(node => node.get(key)),
    );

    const responses = results
      .filter((r): r is PromiseFulfilledResult<VersionedValue<T>> =>
        r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    if (responses.length < this.readQuorum) {
      throw new QuorumNotMetError(
        `Only ${responses.length}/${this.readQuorum} nodes responded`,
      );
    }

    // Return the value with the highest version
    const latest = responses.reduce((max, curr) =>
      curr.version > max.version ? curr : max,
    );

    // Read repair: update stale nodes in background
    this.repairStaleNodes(key, latest, responses);

    return latest.value;
  }

  private async repairStaleNodes(
    key: string,
    latest: VersionedValue<T>,
    responses: VersionedValue<T>[],
  ): Promise<void> {
    // Fire-and-forget — don't block the read
    for (let i = 0; i < responses.length; i++) {
      if (responses[i].version < latest.version) {
        this.nodes[i].put(key, latest.value, latest.version).catch(() => {
          // Log repair failure — anti-entropy will catch it later
        });
      }
    }
  }
}
```

---

## 7. Write-Ahead Log (WAL) Pattern

```
EVERY reliable storage system uses WAL:
  1. Write the change to an append-only log FIRST
  2. Then apply the change to the actual data structure
  3. If crash occurs, replay the log to recover

WHY:
  - Append to log = sequential write = FAST
  - Applying to data = random write = SLOW
  - If crash during apply, log has the complete record for recovery

USED BY:
  - PostgreSQL: WAL (Write-Ahead Log)
  - MySQL: InnoDB redo log
  - Kafka: Commit log (the entire data model IS a log)
  - Event sourcing: Event store IS a WAL
  - Redis: AOF (Append-Only File)

REPLICATION:
  WAL is also the mechanism for replication.
  Primary streams its WAL to replicas.
  Replicas replay the WAL to stay in sync.

  PostgreSQL: Streaming replication sends WAL segments
  MySQL: Binary log (binlog) replication
  Kafka: Partition replication
```

---

## 8. Consistency in Practice — Database Configuration

```
POSTGRESQL:
  Strong consistency:
    synchronous_commit = on
    synchronous_standby_names = 'replica1,replica2'
    default_transaction_isolation = 'serializable'

  Read-your-writes:
    synchronous_commit = on (for writes)
    Read from primary after write, replicas otherwise

  Eventual consistency:
    synchronous_commit = off (async replication)
    Read from any replica

MONGODB:
  Strong consistency:
    writeConcern: { w: "majority", j: true }
    readConcern: "linearizable"

  Causal consistency:
    Start a causal session
    readConcern: "majority"
    writeConcern: { w: "majority" }

  Eventual consistency:
    writeConcern: { w: 1 }
    readConcern: "local"

CASSANDRA:
  Strong consistency:
    CONSISTENCY QUORUM (or ALL) for reads AND writes
    Requires W + R > N

  Eventual consistency:
    CONSISTENCY ONE for reads and writes
    Fastest, but may read stale data

DYNAMODB:
  Strong consistency:
    ConsistentRead: true (reads from leader)

  Eventual consistency (default):
    ConsistentRead: false (reads from any replica)
    Half the cost of consistent reads
```

---

## 9. Choosing the Right Consistency Model

```
DECISION FRAMEWORK:

For EACH data type in your system, answer:

1. What is the COST of reading stale data?
   → Financial loss → Linearizable or Sequential
   → Wrong business decision → Causal or Read-your-writes
   → Cosmetic issue → Eventual with monotonic reads
   → No impact → Eventual

2. What is the COST of write unavailability?
   → Revenue loss per second → Eventual (AP)
   → Users retry later → Strong (CP)
   → Background process → Strong (can wait)

3. How many regions does this data span?
   → Single region → Strong consistency is cheap (<2ms added latency)
   → Multi-region → Strong consistency adds 100-300ms per write
   → Global → Eventual consistency or accept latency

COMMON CHOICES BY DATA TYPE:
  ┌────────────────────────┬─────────────────────┬───────────────────────┐
  │ Data Type              │ Consistency Model    │ Reason                │
  ├────────────────────────┼─────────────────────┼───────────────────────┤
  │ Financial transactions │ Linearizable         │ Money cannot be wrong │
  │ Inventory counts       │ Sequential           │ Overselling = loss    │
  │ User authentication    │ Sequential           │ Security critical     │
  │ Configuration/flags    │ Sequential           │ Wrong config = outage │
  │ User profile           │ Read-your-writes     │ User sees own changes │
  │ Chat messages          │ Causal               │ Order matters causally│
  │ Social media feed      │ Monotonic reads      │ No time travel        │
  │ Product catalog        │ Eventual             │ Stale price is minor  │
  │ Analytics/metrics      │ Eventual             │ Approximate is fine   │
  │ Search index           │ Eventual             │ Slightly stale is OK  │
  │ Recommendations        │ Eventual             │ Freshness not critical│
  └────────────────────────┴─────────────────────┴───────────────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Description | Fix |
|-------------|-------------|-----|
| **Strong Consistency Everywhere** | Linearizable reads for product catalog | Choose consistency per data type |
| **Eventual Consistency for Money** | Eventual reads for account balance | Use strong consistency for financial data |
| **Ignoring Read-Your-Writes** | User updates profile, sees old data | Implement sticky sessions or causal tokens |
| **No Monotonic Reads** | Data appears to go backwards on refresh | Track version per client session |
| **LWW for Everything** | Using last-write-wins for counters | Use CRDTs or application-level merge |
| **Building Custom Consensus** | Implementing your own Paxos/Raft | Use etcd, Zookeeper, or Consul |
| **2PC Across Services** | Distributed transactions across microservices | Use Saga pattern instead |
| **No Conflict Resolution** | Multi-leader setup with no merge strategy | Define merge strategy per data type |
| **Ignoring Stale Reads** | Showing stale data without indicating it | Flag stale data in UI ("updating...") |

---

## 11. Enforcement Checklist

- [ ] **Consistency model chosen per data type** — not one-size-fits-all
- [ ] **Strongest justifiable model used** — weakest model that meets business requirements
- [ ] **Read-your-writes guaranteed for user-facing writes** — users always see their own changes
- [ ] **Monotonic reads guaranteed for user sessions** — data never goes backwards
- [ ] **Conflict resolution strategy defined** — for every piece of data that can have concurrent writes
- [ ] **Quorum configuration validated** — W + R > N if strong consistency is needed
- [ ] **Replication mode matches requirements** — synchronous for strong, asynchronous for eventual
- [ ] **Stale data flagged in UI** — users know when they might be seeing old data
- [ ] **Database configuration matches chosen model** — writeConcern, readConcern, isolation level
- [ ] **Consistency tested under partition** — verify behavior when network splits occur
