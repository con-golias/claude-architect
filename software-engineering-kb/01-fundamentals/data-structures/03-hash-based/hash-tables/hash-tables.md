# Hash Tables

> **Domain:** Fundamentals > Data Structures > Hash-Based
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A hash table (hash map) is a data structure that maps keys to values using a **hash function** to compute an index into an array of buckets. It provides O(1) average-case time for insertion, deletion, and lookup — making it one of the most important and widely used data structures in all of software engineering.

## Why It Matters

- **O(1) average lookup** — the fastest lookup of any general-purpose data structure.
- **Ubiquitous** — used in databases, caches, symbol tables, routers, deduplication, and counting.
- **Foundation of many abstractions** — sets, maps, dictionaries, caches all use hash tables internally.
- **Interview essential** — hash tables are the most commonly used data structure in coding interviews.

## How It Works

### Core Mechanism

```
Key → Hash Function → Index → Bucket → Value

Example:
"alice" → hash("alice") → 7423 → 7423 % 8 = 7 → bucket[7] → {age: 30}

Index:  0     1     2     3     4     5     6     7
      ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
      │     │     │"bob"│     │     │     │     │"alice"│
      │     │     │→ 25 │     │     │     │     │→ 30  │
      └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

### Operations and Time Complexity

| Operation | Average | Worst | Notes |
|-----------|---------|-------|-------|
| Insert | O(1) | O(n) | Worst case: all keys collide |
| Lookup | O(1) | O(n) | Worst case: degenerate to linked list |
| Delete | O(1) | O(n) | Same as lookup |
| Resize | O(n) | O(n) | Rehash all elements |

### Load Factor

```
Load Factor (α) = number of entries / number of buckets

α < 0.75: Good performance (Java HashMap default threshold)
α → 1.0:  Collision rate increases significantly
α > 1.0:  Guaranteed collisions (chaining only)

When α exceeds threshold → resize (typically 2×) and rehash all entries
```

### Language Implementations

```python
# Python — dict (hash table since CPython 3.6+, ordered by insertion)
scores = {}
scores["alice"] = 95       # O(1) insert
scores["bob"] = 87
print(scores["alice"])     # O(1) lookup → 95
del scores["bob"]          # O(1) delete
"alice" in scores          # O(1) membership test

# Dictionary comprehension
word_counts = {word: text.count(word) for word in set(text.split())}
```

```java
// Java — HashMap
Map<String, Integer> scores = new HashMap<>();
scores.put("alice", 95);         // O(1) insert
scores.get("alice");             // O(1) lookup → 95
scores.getOrDefault("eve", 0);   // O(1) with default
scores.remove("alice");          // O(1) delete
scores.containsKey("alice");     // O(1) membership

// Java 8+ — merge, compute, forEach
scores.merge("alice", 1, Integer::sum);  // increment or insert
scores.computeIfAbsent("bob", k -> expensiveLookup(k));
```

```typescript
// TypeScript — Map (preserves insertion order)
const scores = new Map<string, number>();
scores.set("alice", 95);
scores.get("alice");     // 95
scores.has("alice");     // true
scores.delete("alice");
scores.size;             // 0

// Object as hash map (string keys only)
const obj: Record<string, number> = {};
obj["alice"] = 95;
```

```go
// Go — map
scores := map[string]int{
    "alice": 95,
    "bob":   87,
}
score, exists := scores["alice"]  // value, ok pattern
delete(scores, "bob")
```

### Common Patterns

**Frequency Counter:**
```python
from collections import Counter

words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
counts = Counter(words)
# Counter({'apple': 3, 'banana': 2, 'cherry': 1})
counts.most_common(2)  # [('apple', 3), ('banana', 2)]
```

**Two-Sum (Classic Interview Problem):**
```typescript
function twoSum(nums: number[], target: number): [number, number] {
  const seen = new Map<number, number>();  // value → index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement)!, i];
    }
    seen.set(nums[i], i);
  }
  throw new Error("No solution");
}
```

**Grouping:**
```python
from collections import defaultdict

# Group words by first letter
words = ["apple", "avocado", "banana", "blueberry", "cherry"]
groups = defaultdict(list)
for word in words:
    groups[word[0]].append(word)
# {'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}
```

## Best Practices

1. **Use immutable keys** — mutable keys that change after insertion break the hash table.
2. **Override both `hashCode()` and `equals()`** in Java when using custom objects as keys.
3. **Pre-size when count is known** — `new HashMap<>(expectedSize)` avoids unnecessary resizing.
4. **Use `defaultdict` or `getOrDefault`** to avoid key-existence checks.
5. **Choose the right variant** — `HashMap` (unordered), `LinkedHashMap` (insertion order), `TreeMap` (sorted).

## Anti-patterns / Common Mistakes

- **Mutable keys** — if a key's hash changes after insertion, it becomes unfindable.
- **Poor hash functions** — hash functions that cluster produce many collisions, degrading to O(n).
- **Not overriding `hashCode` with `equals`** — in Java, equal objects must have equal hash codes.
- **Using objects as keys in JavaScript** — plain objects auto-convert keys to strings; use `Map` instead.
- **Hash table for sorted iteration** — hash tables don't maintain order; use a tree-based map.

## Real-world Examples

- **Database indexes** — hash indexes for equality lookups.
- **Caches** — Memcached, Redis use hash tables for O(1) key-value access.
- **Compiler symbol tables** — variable/function names mapped to memory addresses.
- **DNS resolution** — domain names hashed to IP addresses.
- **Deduplication** — detect duplicate records/files by hashing content.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Wikipedia — Hash Table](https://en.wikipedia.org/wiki/Hash_table)
- [GeeksforGeeks — Collision Resolution Techniques](https://www.geeksforgeeks.org/collision-resolution-techniques/)
