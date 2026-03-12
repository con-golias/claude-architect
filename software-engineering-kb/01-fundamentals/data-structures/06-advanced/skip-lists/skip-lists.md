# Skip Lists

> **Domain:** Fundamentals > Data Structures > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A skip list is a **probabilistic data structure** that provides O(log n) average-case search, insertion, and deletion in a sorted sequence. It works like a linked list with multiple layers of "express lanes" — higher levels skip over many elements, allowing binary-search-like performance without the complexity of balanced trees.

Invented by William Pugh in 1990 as a simpler alternative to balanced BSTs.

## Why It Matters

- **Simpler than balanced trees** — no rotations, no rebalancing logic.
- **O(log n) average performance** — competitive with AVL and Red-Black trees.
- **Easy concurrent implementation** — lock-free skip lists are simpler than lock-free trees.
- **Used in production** — Redis sorted sets, LevelDB, MemSQL, Apache Lucene.

## How It Works

### Structure

```
Level 3: head ────────────────────────→ 50 ────────────────→ null
Level 2: head ──────→ 20 ────────────→ 50 ──────→ 70 ────→ null
Level 1: head → 10 → 20 → 30 → 40 → 50 → 60 → 70 → 80 → null
Level 0: head → 10 → 20 → 30 → 40 → 50 → 60 → 70 → 80 → null

Search for 60:
Level 3: head → (60 > 50?) YES → 50 → (next is null, go down)
Level 2: 50 → (60 < 70?) YES → go down
Level 1: 50 → 60 ✓ FOUND!

Only 3 comparisons instead of scanning all 8 elements.
```

### Level Assignment (Coin Flip)

Each new element's level is determined by random coin flips:
- Level 0: always (100%)
- Level 1: 50% probability
- Level 2: 25% probability
- Level k: (1/2)^k probability

```python
import random

def random_level(max_level: int = 16) -> int:
    level = 0
    while random.random() < 0.5 and level < max_level:
        level += 1
    return level
```

### Implementation

```python
class SkipListNode:
    def __init__(self, key, level):
        self.key = key
        self.forward = [None] * (level + 1)

class SkipList:
    def __init__(self, max_level=16):
        self.max_level = max_level
        self.level = 0
        self.header = SkipListNode(-float('inf'), max_level)

    def search(self, key) -> bool:
        """O(log n) average — search for a key."""
        current = self.header
        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].key < key:
                current = current.forward[i]
        current = current.forward[0]
        return current is not None and current.key == key

    def insert(self, key):
        """O(log n) average — insert a key."""
        update = [None] * (self.max_level + 1)
        current = self.header

        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].key < key:
                current = current.forward[i]
            update[i] = current

        new_level = random_level(self.max_level)
        if new_level > self.level:
            for i in range(self.level + 1, new_level + 1):
                update[i] = self.header
            self.level = new_level

        new_node = SkipListNode(key, new_level)
        for i in range(new_level + 1):
            new_node.forward[i] = update[i].forward[i]
            update[i].forward[i] = new_node

    def delete(self, key):
        """O(log n) average — delete a key."""
        update = [None] * (self.max_level + 1)
        current = self.header

        for i in range(self.level, -1, -1):
            while current.forward[i] and current.forward[i].key < key:
                current = current.forward[i]
            update[i] = current

        target = current.forward[0]
        if target and target.key == key:
            for i in range(self.level + 1):
                if update[i].forward[i] != target:
                    break
                update[i].forward[i] = target.forward[i]
            while self.level > 0 and self.header.forward[self.level] is None:
                self.level -= 1
```

### Operations and Time Complexity

| Operation | Average | Worst | Notes |
|-----------|---------|-------|-------|
| Search | O(log n) | O(n) | Worst case is unlikely |
| Insert | O(log n) | O(n) | Random level assignment |
| Delete | O(log n) | O(n) | Find + unlink |
| Range query | O(log n + k) | — | k = number of results |
| Space | O(n) | O(n log n) | Expected ~2n pointers |

### Skip List vs Balanced BST

| Property | Skip List | Red-Black Tree |
|----------|-----------|---------------|
| Search | O(log n) average | O(log n) worst |
| Insert | O(log n) average | O(log n) worst |
| Complexity | Simple | Complex (rotations) |
| Concurrency | Easy (lock-free possible) | Hard |
| Range queries | Natural (traverse level 0) | Inorder traversal |
| Cache locality | Moderate | Moderate |
| Deterministic | No (probabilistic) | Yes |

## Best Practices

1. **Use skip lists when concurrency matters** — lock-free skip lists are much simpler than lock-free trees.
2. **Set max level to log₂(n)** — typically 16-32 for most applications.
3. **Use probability p = 0.5** for coin flip — gives best time-space tradeoff.
4. **Prefer library implementations** for production — Redis's sorted sets are a well-tested example.
5. **Use for range queries** — level-0 traversal makes range scans natural.

## Anti-patterns / Common Mistakes

- **Relying on worst-case guarantee** — skip lists are probabilistic; worst case is O(n) (very unlikely).
- **Too many levels** — wastes memory; cap at log₂(expected_n).
- **Biased random generator** — a bad RNG produces unbalanced levels.
- **Implementing from scratch when a tree suffices** — skip lists shine in concurrent scenarios.

## Real-world Examples

- **Redis Sorted Sets (ZSET)** — skip lists enable O(log n) range queries on sorted data.
- **LevelDB / RocksDB** — skip lists used for in-memory tables (MemTable).
- **Apache Lucene** — skip lists in posting list compression for search indexes.
- **Java `ConcurrentSkipListMap`** — concurrent sorted map implementation.
- **MemSQL** — uses lock-free skip lists for in-memory indexes.

## Sources

- Pugh, W. (1990). "Skip Lists: A Probabilistic Alternative to Balanced Trees."
- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Wikipedia — Skip List](https://en.wikipedia.org/wiki/Skip_list)
