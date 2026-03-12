# Consensus Protocols for Distributed Databases

> **Domain:** Database > Distributed Databases > Consensus
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Every distributed database must solve one fundamental problem: how do multiple nodes agree on the same value when nodes can fail, networks can partition, and messages can be delayed? Consensus protocols are the algorithms that make this possible. Without consensus, a distributed database cannot guarantee that a committed transaction is durable across nodes, that all replicas see the same data, or that leader election happens correctly after a failure. Raft, Paxos, and their variants are the foundations of every modern distributed SQL database — CockroachDB, TiDB, YugabyteDB, and Google Spanner all rely on consensus at their core.

---

## How It Works

### The Consensus Problem

```
The Problem:
Node A receives: SET x = 5
Node B receives: SET x = 7
Node C receives: (no request)

Without consensus:
  Node A thinks x = 5
  Node B thinks x = 7
  Node C thinks x = ???  → INCONSISTENT STATE

With consensus (Raft/Paxos):
  1. One node is elected leader
  2. All writes go through leader
  3. Leader replicates to majority before committing
  4. All nodes agree x = 5 (or x = 7, but the SAME value)

Requirement: Agreement despite failures
  • Node failures (crash, restart)
  • Network partitions (nodes cannot communicate)
  • Message delays (arbitrary latency)
```

### FLP Impossibility

```
Fischer-Lynch-Paterson (1985):
  No deterministic consensus algorithm can guarantee
  termination in an asynchronous system with even ONE
  faulty process.

Practical implication:
  All real consensus protocols use TIMEOUTS to break
  the impossibility — they sacrifice liveness (may
  not terminate) during partitions but never sacrifice
  safety (never disagree).
```

---

### Raft Consensus Protocol

```
Raft: Designed for understandability (2014, Diego Ongaro)
Used by: CockroachDB, TiKV (TiDB), YugabyteDB, etcd, Consul

Three sub-problems:
1. Leader Election — choose one leader
2. Log Replication — leader replicates entries to followers
3. Safety — committed entries are never lost

Node States:
┌──────────┐     timeout      ┌──────────────┐
│ Follower │────────────────►│  Candidate   │
│          │◄────────────────│              │
└──────┬───┘   higher term   └──────┬───────┘
       │                            │
       │       wins election        │
       │         ┌──────────┐       │
       │         │  Leader  │◄──────┘
       │         │          │
       │         └──────┬───┘
       │                │
       └────────────────┘
         discovers higher term
```

#### Leader Election

```
Election Process:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  1. Follower times out (no heartbeat from leader)     │
│  2. Becomes Candidate, increments term                │
│  3. Votes for itself, sends RequestVote to all nodes  │
│  4. Wins if receives majority votes                   │
│  5. Becomes Leader, sends heartbeats                  │
│                                                        │
│  Term 1:  Leader=A                                    │
│  ┌───┐    ┌───┐    ┌───┐                             │
│  │ A │◄──│ B │    │ C │   A sends heartbeats         │
│  │ L │   │ F │    │ F │   B, C follow                │
│  └───┘    └───┘    └───┘                             │
│                                                        │
│  A crashes → B times out                              │
│                                                        │
│  Term 2:  Leader=B                                    │
│  ┌───┐    ┌───┐    ┌───┐                             │
│  │ A │    │ B │◄──│ C │   B wins election            │
│  │ ✗ │    │ L │   │ F │   C votes for B              │
│  └───┘    └───┘    └───┘   Majority (2/3) achieved   │
│                                                        │
│  Randomized election timeout (150-300ms):             │
│  prevents split votes by staggering elections         │
└──────────────────────────────────────────────────────┘
```

#### Log Replication

```
Log Replication Flow:
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  Client → Leader: "SET x = 5"                            │
│                                                           │
│  Step 1: Leader appends to its log                       │
│  ┌───────────────────────────────────────┐               │
│  │ Leader Log: [idx:1 SET x=5] [idx:2 ...] │             │
│  └───────────────────────────────────────┘               │
│                                                           │
│  Step 2: Leader sends AppendEntries to followers         │
│  Leader ─── AppendEntries(idx:1, SET x=5) ──► Follower A │
│  Leader ─── AppendEntries(idx:1, SET x=5) ──► Follower B │
│                                                           │
│  Step 3: Followers append to their logs, respond ACK     │
│  Follower A ─── ACK ──► Leader                          │
│  Follower B ─── ACK ──► Leader                          │
│                                                           │
│  Step 4: Leader commits (majority acknowledged)          │
│  Commit index advances to 1                              │
│  Leader responds to client: "OK"                         │
│                                                           │
│  Step 5: Followers learn commit on next heartbeat        │
│  Apply committed entry to state machine                  │
│                                                           │
│  Key: Entry is committed only after majority ACK         │
│  3 nodes → need 2 ACKs (leader + 1 follower)            │
│  5 nodes → need 3 ACKs (leader + 2 followers)           │
└─────────────────────────────────────────────────────────┘
```

#### Safety Guarantees

```
Raft Safety Properties:

1. Election Safety
   At most one leader per term

2. Leader Append-Only
   Leader never overwrites or deletes entries

3. Log Matching
   If two logs contain an entry with the same
   index and term, the logs are identical up to
   that index

4. Leader Completeness
   If an entry is committed in term T, it will
   be present in the leader's log for all terms > T

5. State Machine Safety
   If a server has applied a log entry at index i,
   no other server will apply a different entry at i
```

```go
// Go — Simplified Raft state machine
type RaftState int

const (
    Follower RaftState = iota
    Candidate
    Leader
)

type RaftNode struct {
    mu          sync.Mutex
    state       RaftState
    currentTerm uint64
    votedFor    string      // candidateId voted for in current term
    log         []LogEntry  // replicated log
    commitIndex uint64      // highest log entry known to be committed
    lastApplied uint64      // highest log entry applied to state machine

    // Leader-only state
    nextIndex  map[string]uint64 // for each follower: next log index to send
    matchIndex map[string]uint64 // for each follower: highest log index replicated
}

type LogEntry struct {
    Term    uint64
    Index   uint64
    Command interface{} // state machine command
}

// AppendEntries RPC (leader → follower)
type AppendEntriesRequest struct {
    Term         uint64     // leader's term
    LeaderID     string
    PrevLogIndex uint64     // index of log entry preceding new ones
    PrevLogTerm  uint64     // term of prevLogIndex entry
    Entries      []LogEntry // new entries (empty for heartbeat)
    LeaderCommit uint64     // leader's commit index
}

type AppendEntriesResponse struct {
    Term    uint64 // follower's current term
    Success bool   // true if follower matched prevLog
}
```

---

### Paxos

```
Paxos: The original consensus protocol (1989, Leslie Lamport)
Used by: Google Spanner, Google Chubby, Apache Zookeeper (ZAB variant)

Roles:
  Proposer  — proposes values (typically the leader)
  Acceptor  — votes on proposals (all nodes)
  Learner   — learns decided values (all nodes)

Two Phases:
┌──────────────────────────────────────────────────┐
│                                                    │
│  Phase 1: Prepare                                 │
│  Proposer → Acceptors: Prepare(n)                 │
│  Acceptors → Proposer: Promise(n, accepted_value) │
│  "Will you promise not to accept proposals < n?"  │
│                                                    │
│  Phase 2: Accept                                  │
│  Proposer → Acceptors: Accept(n, value)           │
│  Acceptors → Proposer: Accepted(n)                │
│  "I accept value v for proposal n"                │
│                                                    │
│  Value is chosen when majority of acceptors       │
│  accept the same proposal number                  │
└──────────────────────────────────────────────────┘

Paxos Variants:
┌────────────────┬─────────────────────────────────┐
│ Variant        │ Used By                          │
├────────────────┼─────────────────────────────────┤
│ Basic Paxos    │ Theoretical foundation           │
│ Multi-Paxos    │ Chubby, repeated consensus       │
│ Fast Paxos     │ Fewer message rounds             │
│ Cheap Paxos    │ Fewer acceptors needed           │
│ EPaxos (2013)  │ Leaderless, lower latency       │
│ Flexible Paxos │ Configurable quorum sizes        │
└────────────────┴─────────────────────────────────┘
```

---

### Raft vs Paxos

| Aspect | Raft | Paxos |
|--------|------|-------|
| **Designed for** | Understandability | Correctness proof |
| **Leader** | Strong leader required | Can be leaderless (EPaxos) |
| **Log ordering** | Sequential (leader-ordered) | Out-of-order possible |
| **Implementation** | Straightforward | Complex, many variants |
| **Performance** | Good (leader bottleneck) | Potentially better (EPaxos) |
| **Adoption** | etcd, CockroachDB, TiKV, Consul | Spanner, Chubby, ZK (ZAB) |
| **Membership changes** | Joint consensus (one at a time) | Complex reconfiguration |
| **Learning curve** | Moderate | Very high |

---

### Multi-Raft (Used in Distributed Databases)

```
Single Raft Group:
  One leader for ALL data → bottleneck at scale

Multi-Raft (CockroachDB, TiKV, YugabyteDB):
  Data split into ranges/regions/tablets
  Each range has its OWN Raft group
  Different leaders for different ranges

┌──────────────────────────────────────────────────────┐
│  Node 1          Node 2          Node 3              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │Range A   │   │Range A   │   │Range A   │        │
│  │(Leader)  │   │(Follower)│   │(Follower)│        │
│  ├──────────┤   ├──────────┤   ├──────────┤        │
│  │Range B   │   │Range B   │   │Range B   │        │
│  │(Follower)│   │(Leader)  │   │(Follower)│        │
│  ├──────────┤   ├──────────┤   ├──────────┤        │
│  │Range C   │   │Range C   │   │Range C   │        │
│  │(Follower)│   │(Follower)│   │(Leader)  │        │
│  └──────────┘   └──────────┘   └──────────┘        │
│                                                      │
│  Benefits:                                           │
│  • Write throughput scales with ranges               │
│  • Leaders spread across nodes (load balancing)     │
│  • Range splits/merges adapt to data size           │
│  • Parallel consensus across independent ranges     │
│                                                      │
│  Challenge:                                          │
│  • Cross-range transactions need 2-phase commit     │
│  • More Raft groups = more heartbeat traffic        │
│  • Range size must be tuned (too small = overhead)  │
└──────────────────────────────────────────────────────┘
```

---

### Consensus in Practice

```
Write Path in CockroachDB:
┌─────────────────────────────────────────────────────┐
│                                                       │
│  1. Client: BEGIN; UPDATE accounts SET ...            │
│  2. SQL layer: Parse, Plan, find range leaders       │
│  3. KV layer: Send write to range leader             │
│  4. Range leader: Propose via Raft                   │
│  5. Raft: Replicate to majority (2/3 or 3/5)        │
│  6. Committed: Respond to SQL layer                  │
│  7. Client: COMMIT                                   │
│                                                       │
│  Latency breakdown (same region):                    │
│  • SQL parsing/planning: ~1ms                        │
│  • Raft replication: ~2-5ms (network round-trip)     │
│  • Storage (Pebble write): ~0.5ms                    │
│  • Total: ~4-8ms per write                           │
│                                                       │
│  Latency breakdown (cross-region):                   │
│  • SQL parsing/planning: ~1ms                        │
│  • Raft replication: ~50-200ms (cross-region RTT)    │
│  • Storage: ~0.5ms                                   │
│  • Total: ~50-200ms per write                        │
└─────────────────────────────────────────────────────┘
```

---

### Clock Synchronization

```
Distributed transactions need ordering of events:
Which transaction happened first?

Approaches:
┌─────────────────────────────────────────────────────┐
│                                                       │
│  1. Lamport Clocks (logical)                         │
│     • Counter incremented on events                  │
│     • Partial ordering only                          │
│     • Cannot determine real-time order               │
│     • Used by: basic distributed systems             │
│                                                       │
│  2. Hybrid Logical Clocks (HLC)                      │
│     • Combines physical clock + logical counter      │
│     • Causally consistent ordering                   │
│     • No wait time needed                            │
│     • Used by: CockroachDB, YugabyteDB              │
│                                                       │
│  3. TrueTime (Google Spanner)                        │
│     • GPS + atomic clocks in every datacenter        │
│     • Returns interval [earliest, latest]            │
│     • Wait out uncertainty before commit             │
│     • Provides external consistency (linearizable)   │
│     • Used by: Google Spanner only (proprietary HW)  │
│                                                       │
│  4. Timestamp Oracle (TSO)                           │
│     • Centralized timestamp generator                │
│     • Monotonically increasing timestamps            │
│     • Single point of failure (mitigated by HA)      │
│     • Used by: TiDB (PD server)                      │
└─────────────────────────────────────────────────────┘

CockroachDB HLC:
  timestamp = (physical_time, logical_counter)

  physical_time: from node's wall clock
  logical_counter: breaks ties when physical clocks match

  Uncertainty interval: if two nodes' clocks differ by ε,
  a transaction may need to retry if it reads a value with
  timestamp in its uncertainty window.

  Max clock offset default: 500ms
  NTP keeps clocks within ~10ms typically
```

```python
# Python — Simplified HLC implementation
from dataclasses import dataclass
import time

@dataclass
class HybridTimestamp:
    physical: int  # nanoseconds since epoch
    logical: int   # logical counter

    def __gt__(self, other: 'HybridTimestamp') -> bool:
        if self.physical != other.physical:
            return self.physical > other.physical
        return self.logical > other.logical

class HLC:
    def __init__(self):
        self.ts = HybridTimestamp(0, 0)

    def now(self) -> HybridTimestamp:
        """Generate timestamp for local event."""
        wall = time.time_ns()
        if wall > self.ts.physical:
            self.ts = HybridTimestamp(wall, 0)
        else:
            self.ts = HybridTimestamp(self.ts.physical, self.ts.logical + 1)
        return self.ts

    def receive(self, remote: HybridTimestamp) -> HybridTimestamp:
        """Update clock on receiving message from remote node."""
        wall = time.time_ns()
        if wall > self.ts.physical and wall > remote.physical:
            self.ts = HybridTimestamp(wall, 0)
        elif remote.physical > self.ts.physical:
            self.ts = HybridTimestamp(remote.physical, remote.logical + 1)
        elif self.ts.physical > remote.physical:
            self.ts = HybridTimestamp(self.ts.physical, self.ts.logical + 1)
        else:  # equal physical
            self.ts = HybridTimestamp(
                self.ts.physical,
                max(self.ts.logical, remote.logical) + 1
            )
        return self.ts
```

---

### Byzantine Fault Tolerance (BFT)

```
Crash Fault Tolerance (CFT) — Raft, Paxos:
  Assumption: Nodes may crash but never lie
  Tolerance: f failures out of 2f+1 nodes
  Example: 3 nodes tolerates 1 crash, 5 nodes tolerates 2

Byzantine Fault Tolerance (BFT):
  Assumption: Nodes may behave arbitrarily (lie, tamper)
  Tolerance: f failures out of 3f+1 nodes
  Example: 4 nodes tolerates 1 Byzantine, 7 tolerates 2

When to use BFT:
  • Blockchain networks (untrusted participants)
  • Multi-organization databases (no single trust domain)
  • Military/high-security systems

When CFT is sufficient (ALWAYS for internal databases):
  • Your own infrastructure
  • Trusted datacenter operators
  • Cloud-managed databases

  CFT databases: CockroachDB, TiDB, YugabyteDB, Spanner
  BFT databases: blockchain (Tendermint/CometBFT), HyperledgerFabric
```

---

## Best Practices

1. **ALWAYS use Raft-based systems** for new distributed database deployments — simpler, well-understood
2. **ALWAYS configure odd number of nodes** (3, 5, 7) — even numbers provide no additional fault tolerance
3. **ALWAYS keep NTP synchronized** across cluster nodes — clock skew causes transaction retries
4. **ALWAYS set appropriate election timeouts** — too short causes unnecessary elections, too long causes slow failover
5. **ALWAYS monitor Raft metrics** — commit latency, leader changes, log lag between leader and followers
6. **ALWAYS prefer Multi-Raft** over single Raft group — single group becomes a bottleneck
7. **NEVER ignore clock skew warnings** — distributed transactions depend on clock accuracy
8. **NEVER use even node counts** — 4 nodes tolerates same failures as 3 but needs more resources
9. **NEVER deploy consensus nodes across high-latency links without understanding impact** — consensus latency = network RTT
10. **NEVER use BFT for internal infrastructure** — CFT (Raft/Paxos) is sufficient and much faster

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Even number of nodes | Same fault tolerance as n-1, wasted resources | Use odd numbers (3, 5, 7) |
| Nodes across slow WAN links | High write latency (consensus requires majority RTT) | Co-locate consensus group in same region or use Multi-Raft with locality |
| No NTP synchronization | Excessive transaction retries, uncertainty intervals | Configure NTP/chrony with tight sync |
| Too-short election timeout | Frequent spurious leader elections | Set election timeout 10x heartbeat interval |
| Too-long election timeout | Slow failover when leader crashes | Balance: 150-500ms typical |
| Single Raft group for all data | Leader bottleneck, no parallel writes | Use Multi-Raft with range/tablet splitting |
| Ignoring consensus metrics | Undetected replication lag | Monitor Raft commit latency, term changes, log index lag |
| BFT for internal database | 3x overhead, no benefit | Use CFT (Raft) for trusted infrastructure |
| Not handling leader stepdown | Application errors during leader transition | Implement retry with backoff in application |
| Cross-region consensus group | Every write pays cross-region RTT | Use geo-partitioning, keep consensus local |

---

## Real-world Examples

### etcd (Kubernetes)
- Single Raft group for Kubernetes cluster state
- Stores all cluster metadata (pods, services, configs)
- Typically 3 or 5 nodes, strongly consistent reads

### CockroachDB
- Multi-Raft: one Raft group per 64MB range
- Thousands of concurrent consensus groups
- Automatic range splits and leader balancing

### Google Spanner
- Paxos-based with TrueTime for global consistency
- GPS + atomic clocks for bounded clock uncertainty
- External consistency: strongest possible guarantee

### Apache Kafka
- KRaft (Kafka Raft) replaced ZooKeeper for metadata consensus
- Controller quorum manages partition leader election
- Separate from data replication (ISR-based, not Raft)

---

## Enforcement Checklist

- [ ] Consensus protocol understood (Raft for most, Paxos for Spanner)
- [ ] Odd number of nodes deployed (3 or 5)
- [ ] Clock synchronization configured (NTP/chrony, < 10ms skew)
- [ ] Election timeout tuned (10x heartbeat, typically 150-500ms)
- [ ] Multi-Raft used for data partitioning (not single group)
- [ ] Raft metrics monitored (commit latency, leader changes, log lag)
- [ ] Application-level retry implemented for consensus conflicts
- [ ] Network latency between consensus nodes measured and acceptable
- [ ] Failure scenarios tested (node crash, network partition)
- [ ] CFT used for internal infrastructure (not BFT)
