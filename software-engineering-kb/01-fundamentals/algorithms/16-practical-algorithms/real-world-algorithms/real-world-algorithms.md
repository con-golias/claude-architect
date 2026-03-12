# Practical Real-World Algorithms

> **Domain**: Fundamentals > Algorithms > Practical
> **Difficulty**: Advanced
> **Last Updated**: 2026-03-07

---

## What It Is

These are the algorithms that power real-world production systems: caching, rate limiting, load balancing, distributed consensus, and large-scale data processing. Unlike textbook algorithms focused on asymptotic complexity, practical algorithms must handle concurrency, failure modes, network partitions, and operational constraints. Understanding these algorithms is essential for designing and operating scalable infrastructure.

---

## Caching Algorithms

Caching stores frequently accessed data in fast storage (memory) to avoid expensive recomputation or slow I/O (disk, network). The core challenge is deciding what to evict when the cache is full.

### LRU (Least Recently Used) Cache

Evicts the item that has not been accessed for the longest time. The most widely used cache replacement policy.

**Data structure**: Doubly-linked list (for O(1) reordering) + hash map (for O(1) lookup).
- On access: move node to front of list.
- On eviction: remove node from back of list.

**Step-by-step eviction** (capacity=3):
```
put(A) -> [A]
put(B) -> [B, A]
put(C) -> [C, B, A]
get(A) -> [A, C, B]         # A moves to front
put(D) -> [D, A, C]         # B evicted (least recently used)
get(C) -> [C, D, A]         # C moves to front
put(E) -> [E, C, D]         # A evicted
```

```python
# Python — LRU Cache with O(1) get and put
class Node:
    def __init__(self, key: int = 0, val: int = 0):
        self.key = key
        self.val = val
        self.prev: 'Node | None' = None
        self.next: 'Node | None' = None

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache: dict[int, Node] = {}
        # Sentinel nodes to avoid null checks
        self.head = Node()  # most recently used
        self.tail = Node()  # least recently used
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node: Node):
        """Remove node from doubly-linked list."""
        node.prev.next = node.next
        node.next.prev = node.prev

    def _add_to_front(self, node: Node):
        """Add node right after head (most recently used position)."""
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        node = self.cache[key]
        self._remove(node)
        self._add_to_front(node)
        return node.val

    def put(self, key: int, value: int):
        if key in self.cache:
            self._remove(self.cache[key])
            del self.cache[key]

        node = Node(key, value)
        self.cache[key] = node
        self._add_to_front(node)

        if len(self.cache) > self.capacity:
            # Evict LRU (node before tail)
            lru = self.tail.prev
            self._remove(lru)
            del self.cache[lru.key]

# Usage
cache = LRUCache(3)
cache.put(1, 10)
cache.put(2, 20)
cache.put(3, 30)
print(cache.get(1))    # 10 — moves key 1 to front
cache.put(4, 40)       # evicts key 2 (least recently used)
print(cache.get(2))    # -1 (evicted)
```

```typescript
// TypeScript — LRU Cache
class LRUNode {
    key: number;
    val: number;
    prev: LRUNode | null = null;
    next: LRUNode | null = null;

    constructor(key: number = 0, val: number = 0) {
        this.key = key;
        this.val = val;
    }
}

class LRUCache {
    private capacity: number;
    private cache: Map<number, LRUNode> = new Map();
    private head: LRUNode = new LRUNode();
    private tail: LRUNode = new LRUNode();

    constructor(capacity: number) {
        this.capacity = capacity;
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    private remove(node: LRUNode): void {
        node.prev!.next = node.next;
        node.next!.prev = node.prev;
    }

    private addToFront(node: LRUNode): void {
        node.next = this.head.next;
        node.prev = this.head;
        this.head.next!.prev = node;
        this.head.next = node;
    }

    get(key: number): number {
        if (!this.cache.has(key)) return -1;
        const node = this.cache.get(key)!;
        this.remove(node);
        this.addToFront(node);
        return node.val;
    }

    put(key: number, value: number): void {
        if (this.cache.has(key)) {
            this.remove(this.cache.get(key)!);
            this.cache.delete(key);
        }

        const node = new LRUNode(key, value);
        this.cache.set(key, node);
        this.addToFront(node);

        if (this.cache.size > this.capacity) {
            const lru = this.tail.prev!;
            this.remove(lru);
            this.cache.delete(lru.key);
        }
    }
}
```

**Real-world usage**: CPU L1/L2/L3 caches, database buffer pools, web browser cache, Redis `allkeys-lru`, Memcached, CDN edge caches, operating system page replacement.

### LFU (Least Frequently Used) Cache

Evicts the item with the lowest access frequency. On ties, evicts the least recently used among them. Uses frequency buckets with a doubly-linked list per bucket.

```python
# Python — LFU Cache (simplified)
from collections import defaultdict, OrderedDict

class LFUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.min_freq = 0
        self.key_to_val: dict[int, int] = {}
        self.key_to_freq: dict[int, int] = {}
        self.freq_to_keys: dict[int, OrderedDict] = defaultdict(OrderedDict)

    def _update_freq(self, key: int):
        freq = self.key_to_freq[key]
        self.freq_to_keys[freq].pop(key)
        if not self.freq_to_keys[freq]:
            del self.freq_to_keys[freq]
            if self.min_freq == freq:
                self.min_freq += 1
        self.key_to_freq[key] = freq + 1
        self.freq_to_keys[freq + 1][key] = None

    def get(self, key: int) -> int:
        if key not in self.key_to_val:
            return -1
        self._update_freq(key)
        return self.key_to_val[key]

    def put(self, key: int, value: int):
        if self.capacity <= 0:
            return
        if key in self.key_to_val:
            self.key_to_val[key] = value
            self._update_freq(key)
            return

        if len(self.key_to_val) >= self.capacity:
            # Evict least frequent, least recent
            evict_key, _ = self.freq_to_keys[self.min_freq].popitem(last=False)
            if not self.freq_to_keys[self.min_freq]:
                del self.freq_to_keys[self.min_freq]
            del self.key_to_val[evict_key]
            del self.key_to_freq[evict_key]

        self.key_to_val[key] = value
        self.key_to_freq[key] = 1
        self.freq_to_keys[1][key] = None
        self.min_freq = 1
```

### Cache Replacement Policies Comparison

```
Policy    Evicts                      Use Case                      Real-World
──────────────────────────────────────────────────────────────────────────────────
FIFO      Oldest inserted             Simple, fair                  Basic buffers
LRU       Least recently accessed     General purpose               Redis, Memcached
LFU       Least frequently accessed   Popularity-based content      CDN caching
LRU-K     Least recently used K-th    Database buffer management    DB2
ARC       Adaptive (LRU + LFU)        Self-tuning workloads         ZFS, PostgreSQL
CLOCK     Approximate LRU             OS page replacement           Linux kernel
Random    Random victim               Simple, no overhead           Some CPU caches
```

---

## Rate Limiting

Rate limiting controls how many requests a client can make in a given time period. It protects services from abuse, ensures fair usage, and prevents cascading failures.

### Token Bucket

The most popular rate limiting algorithm. A bucket holds tokens that are added at a constant rate. Each request consumes one (or more) tokens. If the bucket is empty, requests are rejected or delayed.

**Parameters**:
- `bucket_size` (burst capacity): maximum number of tokens the bucket can hold.
- `refill_rate`: tokens added per second.

```python
# Python — Token Bucket
import time

class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = capacity
        self.last_refill = time.monotonic()

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        new_tokens = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + new_tokens)
        self.last_refill = now

    def allow_request(self, tokens: int = 1) -> bool:
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def wait_time(self) -> float:
        """Return seconds to wait before a token is available."""
        self._refill()
        if self.tokens >= 1:
            return 0.0
        return (1 - self.tokens) / self.refill_rate

# Usage
limiter = TokenBucket(capacity=10, refill_rate=2.0)  # 10 burst, 2/sec steady

for i in range(15):
    allowed = limiter.allow_request()
    print(f"Request {i+1}: {'ALLOWED' if allowed else 'REJECTED'}")
    # First 10 allowed (burst), then ~1 every 0.5s
```

```typescript
// TypeScript — Token Bucket
class TokenBucket {
    private capacity: number;
    private refillRate: number;  // tokens per second
    private tokens: number;
    private lastRefill: number;

    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }

    allowRequest(tokens: number = 1): boolean {
        this.refill();
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        return false;
    }
}

// Express.js middleware example
function rateLimitMiddleware(bucket: TokenBucket) {
    return (req: any, res: any, next: any) => {
        if (bucket.allowRequest()) {
            next();
        } else {
            res.status(429).json({ error: "Too Many Requests" });
        }
    };
}
```

**Real-world usage**: AWS API Gateway, Stripe API, GitHub API, NGINX rate limiting, Google Cloud Endpoints.

### Sliding Window Counter

Combines fixed window accuracy with sliding window smoothness. Maintains counters for the current and previous time windows, then computes a weighted count.

```python
# Python — Sliding Window Counter
import time

class SlidingWindowCounter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.current_count = 0
        self.previous_count = 0
        self.current_window_start = self._get_window_start()

    def _get_window_start(self) -> float:
        now = time.monotonic()
        return now - (now % self.window_seconds)

    def _update_window(self):
        window_start = self._get_window_start()
        if window_start != self.current_window_start:
            elapsed_windows = int((window_start - self.current_window_start) / self.window_seconds)
            if elapsed_windows == 1:
                self.previous_count = self.current_count
            else:
                self.previous_count = 0
            self.current_count = 0
            self.current_window_start = window_start

    def allow_request(self) -> bool:
        self._update_window()
        now = time.monotonic()
        window_position = (now - self.current_window_start) / self.window_seconds

        # Weighted count: blend previous and current window
        estimated = self.previous_count * (1 - window_position) + self.current_count

        if estimated < self.max_requests:
            self.current_count += 1
            return True
        return False

# Usage: max 100 requests per 60-second window
limiter = SlidingWindowCounter(max_requests=100, window_seconds=60.0)
```

### Leaky Bucket

Requests enter a queue (bucket) and are processed at a constant rate. If the queue is full, new requests are dropped. Produces a perfectly smooth output rate.

```python
# Python — Leaky Bucket
import time
from collections import deque

class LeakyBucket:
    def __init__(self, capacity: int, leak_rate: float):
        self.capacity = capacity       # max queue size
        self.leak_rate = leak_rate     # requests processed per second
        self.queue: deque = deque()
        self.last_leak = time.monotonic()

    def _leak(self):
        now = time.monotonic()
        elapsed = now - self.last_leak
        leaks = int(elapsed * self.leak_rate)
        for _ in range(min(leaks, len(self.queue))):
            self.queue.popleft()
        if leaks > 0:
            self.last_leak = now

    def allow_request(self, request_id: str) -> bool:
        self._leak()
        if len(self.queue) < self.capacity:
            self.queue.append(request_id)
            return True
        return False  # bucket overflow -> drop
```

### Rate Limiting Comparison

```
Algorithm          Burst Handling    Smoothness    Memory     Precision    Use Case
──────────────────────────────────────────────────────────────────────────────────────
Token Bucket       Allows bursts     Moderate      O(1)       High        API limiting (most common)
Leaky Bucket       No bursts         Very smooth   O(n)       High        Traffic shaping
Fixed Window       Allows 2x burst   Low           O(1)       Low         Simple counting
Sliding Window     Moderate burst    High          O(n)       High        Accurate limiting
Sliding Counter    Moderate burst    High          O(1)       Medium      Balance of accuracy/memory
```

---

## Load Balancing

Load balancing distributes incoming requests across multiple servers to maximize throughput, minimize response time, and avoid overloading any single server.

### Round Robin

The simplest algorithm: cycle through servers in order. Each server gets requests in rotation.

```python
# Python — Round Robin Load Balancer
class RoundRobinBalancer:
    def __init__(self, servers: list[str]):
        self.servers = servers
        self.index = 0

    def next_server(self) -> str:
        server = self.servers[self.index]
        self.index = (self.index + 1) % len(self.servers)
        return server

# Usage
balancer = RoundRobinBalancer(["server-a", "server-b", "server-c"])
for _ in range(7):
    print(balancer.next_server())
# server-a, server-b, server-c, server-a, server-b, server-c, server-a
```

```typescript
// TypeScript — Round Robin Load Balancer
class RoundRobinBalancer {
    private servers: string[];
    private index: number = 0;

    constructor(servers: string[]) {
        this.servers = servers;
    }

    nextServer(): string {
        const server = this.servers[this.index];
        this.index = (this.index + 1) % this.servers.length;
        return server;
    }
}
```

### Weighted Round Robin

Servers with higher capacity receive proportionally more requests.

```python
# Python — Weighted Round Robin
class WeightedRoundRobin:
    def __init__(self, servers: list[tuple[str, int]]):
        # servers: list of (name, weight)
        self.servers = servers
        self.current_weights = [0] * len(servers)
        self.total_weight = sum(w for _, w in servers)

    def next_server(self) -> str:
        # Smooth Weighted Round Robin (NGINX algorithm)
        max_idx = 0
        for i, (name, weight) in enumerate(self.servers):
            self.current_weights[i] += weight
            if self.current_weights[i] > self.current_weights[max_idx]:
                max_idx = i

        self.current_weights[max_idx] -= self.total_weight
        return self.servers[max_idx][0]

# Usage: server-a gets 5x traffic, server-b 3x, server-c 2x
balancer = WeightedRoundRobin([("server-a", 5), ("server-b", 3), ("server-c", 2)])
results = [balancer.next_server() for _ in range(10)]
print(results)
# Smoothly distributed: a appears 5 times, b 3 times, c 2 times
```

### Least Connections

Route each request to the server with the fewest active connections. Adapts to varying request processing times.

```python
# Python — Least Connections Load Balancer
import threading

class LeastConnectionsBalancer:
    def __init__(self, servers: list[str]):
        self.servers = {s: 0 for s in servers}  # server -> active connections
        self.lock = threading.Lock()

    def next_server(self) -> str:
        with self.lock:
            server = min(self.servers, key=self.servers.get)
            self.servers[server] += 1
            return server

    def release(self, server: str):
        with self.lock:
            self.servers[server] = max(0, self.servers[server] - 1)

# Usage
balancer = LeastConnectionsBalancer(["server-a", "server-b", "server-c"])
server = balancer.next_server()
# ... process request ...
balancer.release(server)
```

### Consistent Hashing (for Distributed Load Balancing)

Maps both servers and keys to a ring (hash space). Each key is served by the nearest server clockwise on the ring. When a server is added or removed, only 1/n of keys are remapped (minimal disruption).

Virtual nodes improve balance: each physical server maps to multiple positions on the ring.

```python
# Python — Consistent Hashing (simplified)
import hashlib
import bisect

class ConsistentHash:
    def __init__(self, nodes: list[str], virtual_nodes: int = 150):
        self.virtual_nodes = virtual_nodes
        self.ring: dict[int, str] = {}
        self.sorted_keys: list[int] = []

        for node in nodes:
            self.add_node(node)

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node: str):
        for i in range(self.virtual_nodes):
            virtual_key = f"{node}:vn{i}"
            h = self._hash(virtual_key)
            self.ring[h] = node
            bisect.insort(self.sorted_keys, h)

    def remove_node(self, node: str):
        for i in range(self.virtual_nodes):
            virtual_key = f"{node}:vn{i}"
            h = self._hash(virtual_key)
            del self.ring[h]
            self.sorted_keys.remove(h)

    def get_node(self, key: str) -> str:
        if not self.ring:
            raise ValueError("No nodes in the ring")
        h = self._hash(key)
        idx = bisect.bisect_right(self.sorted_keys, h)
        if idx == len(self.sorted_keys):
            idx = 0
        return self.ring[self.sorted_keys[idx]]

# Usage
ch = ConsistentHash(["cache-1", "cache-2", "cache-3"])
print(ch.get_node("user:123"))   # cache-2
print(ch.get_node("user:456"))   # cache-1
ch.add_node("cache-4")           # only ~25% of keys remap
print(ch.get_node("user:123"))   # may or may not change
```

**Real-world usage**: Amazon DynamoDB, Apache Cassandra, Memcached clients, Discord, Akamai CDN.

### Load Balancing Comparison

```
Algorithm            Pros                         Cons                        Used By
───────────────────────────────────────────────────────────────────────────────────────────
Round Robin          Simple, fair                 Ignores server load          NGINX, HAProxy
Weighted RR          Handles heterogeneous        Static weights               NGINX, F5
Least Connections    Adaptive to load             Overhead tracking conns      HAProxy, AWS ALB
Consistent Hash      Minimal redistribution       Complex implementation       Cassandra, DynamoDB
Random               Simple, no state             Unpredictable                Some microservices
IP Hash              Session affinity             Uneven distribution          NGINX
```

---

## Consensus Algorithms (Distributed Systems)

Consensus algorithms enable a group of distributed nodes to agree on a value, even when some nodes fail. They are the foundation of fault-tolerant distributed systems.

### Raft

Raft is designed to be understandable. It decomposes consensus into three subproblems: leader election, log replication, and safety.

**Three server states**: Leader, Follower, Candidate.

**Key concepts**:
- **Term**: a logical clock that increases monotonically. Each term has at most one leader.
- **Log**: an ordered sequence of commands that all servers agree on.
- **Commitment**: a log entry is committed when a majority of servers have replicated it.

#### Phase 1: Leader Election

```
1. All servers start as Followers.
2. If a Follower receives no heartbeat for a random timeout (150-300ms),
   it becomes a Candidate and starts an election.
3. Candidate increments its term, votes for itself, and sends
   RequestVote RPCs to all other servers.
4. A server votes for at most one candidate per term (first-come-first-served).
5. If a Candidate receives votes from a majority, it becomes the Leader.
6. If the election times out (split vote), start a new election with
   a new random timeout.
```

```python
# Python — Raft Leader Election (pseudocode-style)
import random
import time
from enum import Enum

class State(Enum):
    FOLLOWER = "follower"
    CANDIDATE = "candidate"
    LEADER = "leader"

class RaftNode:
    def __init__(self, node_id: int, peers: list[int]):
        self.node_id = node_id
        self.peers = peers
        self.state = State.FOLLOWER
        self.current_term = 0
        self.voted_for = None
        self.log = []
        self.commit_index = 0
        self.election_timeout = self._random_timeout()
        self.last_heartbeat = time.monotonic()

    def _random_timeout(self) -> float:
        return random.uniform(0.150, 0.300)  # 150-300ms

    def start_election(self):
        """Transition to Candidate and request votes."""
        self.state = State.CANDIDATE
        self.current_term += 1
        self.voted_for = self.node_id
        votes_received = 1  # vote for self

        # Send RequestVote to all peers
        for peer in self.peers:
            # In real implementation: async RPC
            vote_granted = self._request_vote(peer)
            if vote_granted:
                votes_received += 1

        majority = (len(self.peers) + 1) // 2 + 1
        if votes_received >= majority:
            self.become_leader()
        else:
            self.state = State.FOLLOWER
            self.election_timeout = self._random_timeout()

    def _request_vote(self, peer_id: int) -> bool:
        """Send RequestVote RPC (simplified)."""
        # In practice: network RPC with term, candidateId,
        # lastLogIndex, lastLogTerm
        # Peer grants vote if:
        # 1. Candidate's term >= peer's term
        # 2. Peer hasn't voted for another candidate in this term
        # 3. Candidate's log is at least as up-to-date
        return True  # placeholder

    def become_leader(self):
        """Transition to Leader state."""
        self.state = State.LEADER
        print(f"Node {self.node_id} became leader for term {self.current_term}")
        # Initialize nextIndex and matchIndex for each peer
        # Begin sending AppendEntries heartbeats

    def on_heartbeat_timeout(self):
        """Called when election timeout expires without receiving heartbeat."""
        if self.state == State.FOLLOWER:
            elapsed = time.monotonic() - self.last_heartbeat
            if elapsed > self.election_timeout:
                self.start_election()
```

#### Phase 2: Log Replication

```
1. Client sends command to Leader.
2. Leader appends command to its log.
3. Leader sends AppendEntries RPC to all followers with the new entry.
4. Followers append entry to their logs and respond with success.
5. Once a majority has replicated the entry, Leader commits it.
6. Leader applies committed entry to its state machine and responds to client.
7. Followers learn about committed entries via subsequent AppendEntries.
```

#### Phase 3: Safety

Raft guarantees:
- **Election Safety**: at most one leader per term.
- **Leader Append-Only**: a leader never overwrites or deletes log entries.
- **Log Matching**: if two logs contain an entry with same index and term, the logs are identical up to that index.
- **Leader Completeness**: if a log entry is committed, it will be present in all future leaders' logs.
- **State Machine Safety**: if a server applies a log entry at a given index, no other server applies a different entry at that index.

**Used by**: etcd (Kubernetes control plane), CockroachDB, HashiCorp Consul, TiKV (TiDB), ScyllaDB.

### Paxos

The original consensus algorithm by Leslie Lamport (1989, published 1998 as "The Part-Time Parliament"). Paxos is provably correct but notoriously difficult to understand and implement.

**Three roles**: Proposer, Acceptor, Learner (a node can play multiple roles).

**Two phases**:
```
Phase 1 — Prepare:
  1. Proposer chooses a unique proposal number n.
  2. Proposer sends Prepare(n) to a majority of Acceptors.
  3. Acceptors respond with Promise(n) and any previously accepted value.
     (Acceptor promises not to accept proposals numbered less than n.)

Phase 2 — Accept:
  4. If Proposer receives Promise from a majority:
     - If any Acceptor returned a previously accepted value,
       Proposer must use that value.
     - Otherwise, Proposer uses its own value.
  5. Proposer sends Accept(n, value) to Acceptors.
  6. Acceptors accept if they haven't promised a higher number.
  7. Once a majority accepts, value is chosen. Learners are notified.
```

**Why it is hard to implement**:
- Multiple concurrent proposers can cause livelock.
- Multi-Paxos (for log replication) is significantly more complex.
- The paper is written allegorically, making it hard to derive a practical implementation.

### Raft vs Paxos

```
Feature              Raft                        Paxos
──────────────────────────────────────────────────────────────────
Understandability    High (designed for it)       Low (notoriously complex)
Leader               Required (strong leader)     Optional (leaderless possible)
Implementation       Straightforward              Complex (many variants)
Performance          Good                         Good
Log Replication      Built-in                     Requires Multi-Paxos extension
Membership Changes   Joint consensus              Not specified (extension needed)
Formal Proof         Yes (Ongaro thesis)          Yes (Lamport)
Used By              etcd, Consul, CockroachDB    Chubby, Zookeeper (ZAB variant)
```

---

## Reservoir Sampling

Select k random items from a stream of unknown (potentially infinite) length, where each item has equal probability of being selected. The algorithm processes items one at a time and uses O(k) memory regardless of stream size.

### Algorithm R (Vitter, 1985)

```
1. Fill the reservoir with the first k items.
2. For each subsequent i-th item (i > k):
   a. Generate random j in [0, i).
   b. If j < k, replace reservoir[j] with the i-th item.

Correctness: After processing n items, each item has probability k/n
of being in the reservoir.
```

```python
# Python — Reservoir Sampling
import random

def reservoir_sample(stream, k: int) -> list:
    """Select k random items from an iterable stream."""
    reservoir = []

    for i, item in enumerate(stream):
        if i < k:
            reservoir.append(item)
        else:
            j = random.randint(0, i)  # [0, i] inclusive
            if j < k:
                reservoir[j] = item

    return reservoir

# Proof of correctness (induction):
# Base case: After k items, each is in reservoir with prob 1 = k/k.
# Inductive step: After seeing item i+1:
#   - Item i+1 enters with prob k/(i+1).
#   - Existing item stays with prob 1 - (1/(i+1)) = i/(i+1).
#   - Existing item in reservoir after step i has prob k/i (inductive hypothesis).
#   - After step i+1: (k/i) * (i/(i+1)) = k/(i+1). QED.

# Example: sample 5 items from a stream of 1 million
big_stream = range(1_000_000)
sample = reservoir_sample(big_stream, 5)
print(sample)  # 5 random items, each with equal probability 5/1000000
```

```typescript
// TypeScript — Reservoir Sampling
function reservoirSample<T>(stream: Iterable<T>, k: number): T[] {
    const reservoir: T[] = [];
    let i = 0;

    for (const item of stream) {
        if (i < k) {
            reservoir.push(item);
        } else {
            const j = Math.floor(Math.random() * (i + 1));
            if (j < k) {
                reservoir[j] = item;
            }
        }
        i++;
    }

    return reservoir;
}

// Example: sample 3 random lines from a large file
function sampleLines(lines: string[], k: number): string[] {
    return reservoirSample(lines, k);
}
```

**Applications**: random sampling from database query results (without knowing total count), sampling from real-time data streams (logs, events), A/B testing selection, random auditing of transactions.

---

## MapReduce

A distributed data processing model introduced by Google (Dean & Ghemawat, 2004). It breaks large-scale computation into two phases that can be parallelized across thousands of machines.

### Model

```
Input -> Split -> Map -> Shuffle/Sort -> Reduce -> Output

Map Phase:    Transform each input record into zero or more key-value pairs.
Shuffle:      Group all values by key (distributed sort).
Reduce Phase: For each key, aggregate all associated values into a result.
```

### Word Count Example

```python
# Python — Simulated MapReduce: Word Count
from collections import defaultdict
from typing import Iterator

def mapper(document: str) -> Iterator[tuple[str, int]]:
    """Map phase: emit (word, 1) for each word."""
    for word in document.lower().split():
        # Strip punctuation
        word = ''.join(c for c in word if c.isalnum())
        if word:
            yield (word, 1)

def reducer(key: str, values: list[int]) -> tuple[str, int]:
    """Reduce phase: sum all counts for a word."""
    return (key, sum(values))

def map_reduce(documents: list[str], mapper_fn, reducer_fn):
    """Simulated MapReduce framework."""
    # Map phase
    intermediate: dict[str, list[int]] = defaultdict(list)
    for doc in documents:
        for key, value in mapper_fn(doc):
            intermediate[key].append(value)

    # Shuffle is implicit (grouping by key in the dict)

    # Reduce phase
    results = []
    for key, values in sorted(intermediate.items()):
        results.append(reducer_fn(key, values))

    return results

# Usage
documents = [
    "the quick brown fox jumps over the lazy dog",
    "the fox ate the dog food",
    "the quick red fox"
]

word_counts = map_reduce(documents, mapper, reducer)
for word, count in sorted(word_counts, key=lambda x: -x[1])[:5]:
    print(f"{word}: {count}")
# the: 5, fox: 3, quick: 2, dog: 2, ...
```

**Real-world evolution**:
- **Hadoop MapReduce**: open-source implementation, disk-based (slow for iterative algorithms).
- **Apache Spark**: in-memory computation, 10-100x faster than Hadoop for many workloads. Uses RDDs (Resilient Distributed Datasets) and DataFrames.
- **Apache Flink**: true streaming with exactly-once semantics.
- **Google Dataflow / Apache Beam**: unified batch + stream processing model.

---

## Bloom Filter Applications

A Bloom filter is a space-efficient probabilistic data structure that answers "is element in the set?" with possible false positives but no false negatives. (Detailed implementation in the hashing chapter.)

```
Properties:
- add(element): always succeeds
- contains(element): returns true (possibly false positive) or false (definitely not in set)
- No deletions (use Counting Bloom Filter for deletions)
- Space: ~10 bits per element for 1% false positive rate
```

**Real-world applications**:
- **Web crawlers**: avoid revisiting URLs already crawled (Google, Bing).
- **Database optimization**: avoid disk reads for non-existent rows (HBase, LevelDB, RocksDB, Cassandra use Bloom filters on SSTables).
- **Network routers**: packet routing and deduplication.
- **Spell checkers**: fast pre-check before expensive dictionary lookup.
- **CDN caching**: determine if content is likely cached before checking.
- **Bitcoin**: SPV clients use Bloom filters to request relevant transactions.
- **Chrome Safe Browsing**: checks URLs against a Bloom filter of known malicious sites.

---

## HyperLogLog

Estimate the cardinality (count of distinct elements) of a multiset using O(log log n) space. For practical implementations, uses about 12 KB of memory to estimate cardinalities up to 10^9 with ~2% standard error.

### How It Works

```
Key Insight: If you hash elements uniformly, the maximum number of leading
zeros in any hash tells you about the cardinality.

If max leading zeros = k, estimated cardinality ~ 2^k.

HyperLogLog improvement:
1. Split elements into m = 2^b buckets using first b bits of hash.
2. For each bucket, track the maximum position of the first 1-bit
   in the remaining hash bits.
3. Estimate cardinality using the harmonic mean of 2^(bucket value)
   across all buckets.

Space: m registers of ~5 bits each. With m=2^14 (16384 registers):
       ~12 KB for billions of distinct elements.
Error: ~1.04 / sqrt(m) standard error (~0.81% with m=16384).
```

```python
# Python — Simplified HyperLogLog
import hashlib
import math

class HyperLogLog:
    def __init__(self, precision: int = 14):
        self.p = precision
        self.m = 1 << precision  # number of registers
        self.registers = [0] * self.m
        # Alpha constant for bias correction
        if self.m >= 128:
            self.alpha = 0.7213 / (1 + 1.079 / self.m)
        elif self.m == 64:
            self.alpha = 0.709
        elif self.m == 32:
            self.alpha = 0.697
        else:
            self.alpha = 0.620

    def _hash(self, item: str) -> int:
        return int(hashlib.sha256(item.encode()).hexdigest(), 16)

    def add(self, item: str):
        h = self._hash(item)
        # First p bits determine the bucket
        bucket = h & (self.m - 1)
        # Remaining bits: find position of first 1-bit
        remaining = h >> self.p
        # Count leading zeros + 1
        rho = 1
        while remaining and not (remaining & 1):
            rho += 1
            remaining >>= 1
        self.registers[bucket] = max(self.registers[bucket], rho)

    def estimate(self) -> int:
        # Harmonic mean estimator
        Z = sum(2.0 ** (-r) for r in self.registers)
        E = self.alpha * self.m * self.m / Z

        # Small range correction
        if E <= 2.5 * self.m:
            V = self.registers.count(0)
            if V > 0:
                E = self.m * math.log(self.m / V)

        return int(E)

# Usage
hll = HyperLogLog(precision=14)
for i in range(1_000_000):
    hll.add(f"user:{i}")
print(f"Estimated cardinality: {hll.estimate()}")
# Approximately 1,000,000 +/- ~1%
```

**Real-world usage**:
- **Redis**: `PFADD`, `PFCOUNT`, `PFMERGE` commands use HyperLogLog with 12 KB per key.
- **Analytics systems**: counting unique visitors, unique searches, unique events (Google Analytics, Elasticsearch).
- **Database query optimization**: estimating `SELECT COUNT(DISTINCT col)` without scanning all rows.
- **Network monitoring**: counting unique IP addresses, flows.

---

## Comparison of Practical Algorithms

```
Algorithm         Problem Domain          Time           Space        Accuracy
──────────────────────────────────────────────────────────────────────────────────
LRU Cache         Cache eviction          O(1) ops       O(n)         Exact
LFU Cache         Cache eviction          O(1) ops       O(n)         Exact
Token Bucket      Rate limiting           O(1) per req   O(1)         Exact
Sliding Window    Rate limiting           O(1) per req   O(1)         Approximate
Round Robin       Load balancing          O(1)           O(n servers) N/A
Consistent Hash   Distributed routing     O(log n)       O(n * vnodes) N/A
Raft              Distributed consensus   O(log n) per op O(n * log)  Exact (consensus)
Reservoir Sample  Stream sampling         O(1) per item  O(k)         Exact (probabilistic)
MapReduce         Batch data processing   O(data size)   O(data size) Exact
Bloom Filter      Set membership          O(k hashes)    O(m bits)    No false negatives
HyperLogLog       Cardinality estimation  O(1) per add   O(m regs)    ~1-2% error
```

---

## Key Takeaways

1. **LRU is the default cache policy** for most workloads. Use ARC if you need adaptive behavior without tuning.
2. **Token Bucket is the go-to rate limiter** because it naturally handles both steady-state and burst traffic.
3. **Consistent hashing is essential** for distributed caches and databases where server membership changes.
4. **Raft replaced Paxos** in most new systems because it is easier to understand, implement, and debug.
5. **Reservoir sampling** solves the "random sample from unknown-size stream" problem elegantly in O(k) space.
6. **HyperLogLog** can count billions of distinct elements in 12 KB of memory -- one of the most impressive space-accuracy tradeoffs in computer science.
7. **MapReduce** pioneered large-scale distributed data processing, but has largely been superseded by Apache Spark and streaming frameworks.

---

## Sources

- Dean, Jeffrey and Ghemawat, Sanjay. "MapReduce: Simplified Data Processing on Large Clusters." OSDI, 2004. https://research.google/pubs/pub62/
- Ongaro, Diego and Ousterhout, John. "In Search of an Understandable Consensus Algorithm (Extended Version)." USENIX ATC, 2014. https://raft.github.io/raft.pdf
- Lamport, Leslie. "The Part-Time Parliament." ACM Transactions on Computer Systems, 1998. (Paxos)
- Lamport, Leslie. "Paxos Made Simple." ACM SIGACT News, 2001.
- Vitter, Jeffrey S. "Random Sampling with a Reservoir." ACM Transactions on Mathematical Software, 1985.
- Flajolet, Philippe et al. "HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm." Conference on Analysis of Algorithms, 2007.
- Karger, David et al. "Consistent Hashing and Random Trees: Distributed Caching Protocols for Relieving Hot Spots on the World Wide Web." STOC, 1997.
- Bloom, Burton H. "Space/Time Trade-offs in Hash Coding with Allowable Errors." Communications of the ACM, 1970.
- Wikipedia. "Cache replacement policies," "Token bucket," "Raft (algorithm)," "Reservoir sampling." https://en.wikipedia.org/
- Redis Documentation. HyperLogLog commands. https://redis.io/docs/data-types/hyperloglogs/
