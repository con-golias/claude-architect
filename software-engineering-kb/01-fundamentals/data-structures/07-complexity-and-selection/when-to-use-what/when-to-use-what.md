# Data Structure Selection Guide

> **Domain:** Fundamentals > Data Structures > Complexity and Selection
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Choosing the right data structure is one of the most impactful decisions in software engineering. The wrong choice can make code orders of magnitude slower or more complex than necessary. This guide provides a decision framework based on your access patterns and requirements.

## The Decision Framework

### Start with Your Access Pattern

```
What do you need to do most?

Need O(1) random access by index?
  → Array / Dynamic Array

Need O(1) key-value lookup?
  → Hash Map / Hash Table

Need O(1) membership testing?
  → Hash Set

Need sorted data with O(log n) operations?
  → Balanced BST (TreeMap/TreeSet)

Need LIFO (last in, first out)?
  → Stack

Need FIFO (first in, first out)?
  → Queue / Deque

Need elements processed by priority?
  → Priority Queue (Heap)

Need prefix search / autocomplete?
  → Trie

Need to track connectivity / components?
  → Union-Find (Disjoint Set)

Need range queries with updates?
  → Segment Tree / Fenwick Tree

Need probabilistic membership testing?
  → Bloom Filter
```

## Detailed Selection Matrix

### Sequence / Collection

| Requirement | Best Choice | Why |
|-------------|------------|-----|
| Fast random access, known size | Static Array | O(1) access, cache-friendly |
| Dynamic size, mostly append | Dynamic Array (ArrayList/vector) | O(1) amortized append |
| Frequent insert/delete at front | Deque | O(1) at both ends |
| Frequent insert/delete in middle | Linked List | O(1) with reference |
| LIFO operations | Stack (array-backed) | O(1) push/pop |
| FIFO operations | Queue (linked or circular buffer) | O(1) enqueue/dequeue |
| Priority ordering | Heap / Priority Queue | O(log n) insert/extract |
| Fixed-size streaming buffer | Circular Buffer | O(1), zero allocation |

### Key-Value / Lookup

| Requirement | Best Choice | Why |
|-------------|------------|-----|
| Fast lookup, no ordering needed | HashMap | O(1) average |
| Fast lookup + sorted keys | TreeMap (Red-Black) | O(log n), sorted iteration |
| Fast lookup + insertion order | LinkedHashMap | O(1) + order preserved |
| Membership only (no values) | HashSet | O(1) contains |
| Sorted membership | TreeSet | O(log n), range queries |
| String prefix lookup | Trie | O(m) prefix search |
| Approximate membership | Bloom Filter | Space-efficient, no false negatives |

### Graph / Network

| Requirement | Best Choice | Why |
|-------------|------------|-----|
| Sparse graph storage | Adjacency List | O(V + E) space |
| Dense graph / O(1) edge check | Adjacency Matrix | O(1) edge query |
| Edge-centric processing | Edge List | Simple, sortable |
| Shortest path (non-negative) | Dijkstra with Heap | O((V+E) log V) |
| Shortest path (negative weights) | Bellman-Ford | O(V × E) |
| All-pairs shortest path | Floyd-Warshall | O(V^3) |
| Minimum spanning tree | Kruskal with Union-Find | O(E log E) |
| Dynamic connectivity | Union-Find | O(α(n)) ≈ O(1) |

### Range / Aggregate

| Requirement | Best Choice | Why |
|-------------|------------|-----|
| Static prefix sums | Prefix Sum Array | O(1) query, no updates |
| Range sum with point updates | Fenwick Tree | Simple, O(log n) |
| Range min/max with updates | Segment Tree | O(log n) flexible queries |
| Range updates + range queries | Segment Tree + Lazy Propagation | O(log n) both |
| Sorted range queries | Balanced BST (TreeMap) | subMap, headMap, tailMap |

### Concurrent / Multi-threaded

| Requirement | Best Choice | Why |
|-------------|------------|-----|
| Concurrent hash map | ConcurrentHashMap | Lock-striped, thread-safe |
| Concurrent sorted map | ConcurrentSkipListMap | Lock-free, sorted |
| Producer-consumer queue | BlockingQueue | Thread-safe, blocking |
| Lock-free queue | SPSC Ring Buffer | No locks, bounded |

## Common Mistakes in Data Structure Selection

### Mistake 1: Using a List for Membership Testing
```python
# Bad — O(n) per check
if user_id in user_list:  # scanning entire list

# Good — O(1) per check
if user_id in user_set:   # hash set lookup
```

### Mistake 2: Sorted Array for Dynamic Data
```python
# Bad — O(n) insert to maintain order
sorted_list.insert(bisect.bisect(sorted_list, item), item)

# Good — O(log n) insert with automatic ordering
tree_set.add(item)
```

### Mistake 3: HashMap When You Need Order
```java
// Bad — no guaranteed iteration order
HashMap<String, Integer> map = new HashMap<>();

// Good — preserves insertion order
LinkedHashMap<String, Integer> map = new LinkedHashMap<>();

// Good — sorted by key
TreeMap<String, Integer> map = new TreeMap<>();
```

### Mistake 4: Linked List for Random Access
```
// Bad — O(n) per access
linkedList.get(500);  // traverses 500 nodes

// Good — O(1) per access
arrayList.get(500);   // direct index
```

### Mistake 5: Using O(n^2) When O(n) Is Possible
```python
# Bad — O(n²) with nested loops
for i in range(len(arr)):
    for j in range(i + 1, len(arr)):
        if arr[i] + arr[j] == target:
            return [i, j]

# Good — O(n) with hash map
seen = {}
for i, num in enumerate(arr):
    if target - num in seen:
        return [seen[target - num], i]
    seen[num] = i
```

## Decision Flowchart

```
                    ┌──────────────┐
                    │ What do you  │
                    │ need to do?  │
                    └──────┬───────┘
                           │
         ┌────────────┬────┴─────┬──────────────┐
         ↓            ↓          ↓              ↓
    ┌────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐
    │ Store  │  │ Look up  │  │ Model  │  │ Aggregate│
    │sequence│  │ by key   │  │relation│  │ over     │
    │of items│  │          │  │-ships  │  │ ranges   │
    └───┬────┘  └────┬─────┘  └───┬────┘  └────┬─────┘
        │            │            │             │
  ┌─────┴─────┐   Order?     Graph?      Updates?
  │           │     │            │             │
 Random    Insert/  ├─Yes→TreeMap ├─Sparse→    ├─No→PrefixSum
 access?   delete   │            │  AdjList    │
  │        where?   └─No→HashMap │             ├─Point→Fenwick
  ├─Yes→         │               └─Dense→      │
  │ Array    ┌───┴───┐              AdjMatrix  └─Range→SegTree
  │          │       │                              +Lazy
  └─No→   Front?  Both?
  LinkedList  │       │
            Deque   Deque
```

## Language-Specific Defaults

| Need | Python | Java | TypeScript | C++ |
|------|--------|------|-----------|-----|
| Dynamic array | `list` | `ArrayList` | `Array` | `vector` |
| Hash map | `dict` | `HashMap` | `Map` | `unordered_map` |
| Hash set | `set` | `HashSet` | `Set` | `unordered_set` |
| Sorted map | — | `TreeMap` | — | `map` |
| Sorted set | — | `TreeSet` | — | `set` |
| Stack | `list` | `ArrayDeque` | `Array` | `stack` |
| Queue | `deque` | `LinkedList` | — | `queue` |
| Priority queue | `heapq` | `PriorityQueue` | — | `priority_queue` |
| Deque | `deque` | `ArrayDeque` | — | `deque` |

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Python TimeComplexity (wiki.python.org)](https://wiki.python.org/moin/TimeComplexity)
- Skiena, S. (2008). *The Algorithm Design Manual* (2nd ed.). Springer.
