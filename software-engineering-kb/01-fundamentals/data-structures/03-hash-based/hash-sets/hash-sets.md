# Hash Sets

> **Domain:** Fundamentals > Data Structures > Hash-Based
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

A hash set is an unordered collection of unique elements backed by a hash table. It provides O(1) average-case time for insertion, deletion, and membership testing. Unlike a hash map which stores key-value pairs, a hash set stores only keys (or equivalently, maps keys to a dummy value).

## Why It Matters

- **O(1) membership testing** — "is X in the set?" is the most common operation.
- **Automatic deduplication** — adding a duplicate has no effect.
- **Set operations** — union, intersection, difference, symmetric difference in near-linear time.
- **Essential for algorithms** — tracking visited nodes, deduplication, counting unique elements.

## How It Works

### Operations and Time Complexity

| Operation | Average | Worst | Notes |
|-----------|---------|-------|-------|
| Add | O(1) | O(n) | No-op if already present |
| Remove | O(1) | O(n) | No-op if not present |
| Contains | O(1) | O(n) | Membership test |
| Union | O(n + m) | O(n × m) | Combine two sets |
| Intersection | O(min(n,m)) | O(n × m) | Common elements |
| Difference | O(n) | O(n × m) | Elements in A not in B |

### Language Implementations

```python
# Python — set
colors = {"red", "green", "blue"}
colors.add("yellow")        # O(1)
colors.discard("red")       # O(1), no error if missing
"green" in colors           # O(1) → True

# Set operations
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
a | b    # union:        {1, 2, 3, 4, 5, 6}
a & b    # intersection: {3, 4}
a - b    # difference:   {1, 2}
a ^ b    # symmetric:    {1, 2, 5, 6}

# Deduplication
unique_words = set(word_list)

# Frozen set (immutable, can be used as dict key or set element)
fs = frozenset({1, 2, 3})
```

```java
// Java — HashSet
Set<String> colors = new HashSet<>();
colors.add("red");           // O(1)
colors.remove("red");        // O(1)
colors.contains("green");    // O(1) → false

// Set operations
Set<Integer> a = new HashSet<>(List.of(1, 2, 3, 4));
Set<Integer> b = new HashSet<>(List.of(3, 4, 5, 6));

Set<Integer> union = new HashSet<>(a);
union.addAll(b);             // {1, 2, 3, 4, 5, 6}

Set<Integer> intersection = new HashSet<>(a);
intersection.retainAll(b);   // {3, 4}

// LinkedHashSet preserves insertion order
Set<String> ordered = new LinkedHashSet<>();

// TreeSet maintains sorted order (O(log n) operations)
Set<String> sorted = new TreeSet<>();
```

```typescript
// TypeScript — Set
const colors = new Set<string>();
colors.add("red");
colors.add("red");      // no effect — already present
colors.has("red");      // true
colors.delete("red");
colors.size;             // 0

// Deduplication
const unique = [...new Set(arrayWithDuplicates)];

// Set operations (manual in JS/TS)
const union = new Set([...a, ...b]);
const intersection = new Set([...a].filter(x => b.has(x)));
const difference = new Set([...a].filter(x => !b.has(x)));
```

### Common Patterns

**Deduplication:**
```python
# Remove duplicates while preserving order
def deduplicate(items):
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
```

**Finding duplicates:**
```python
def find_duplicates(items):
    seen = set()
    duplicates = set()
    for item in items:
        if item in seen:
            duplicates.add(item)
        seen.add(item)
    return duplicates
```

**Graph traversal (visited tracking):**
```python
def bfs(graph, start):
    visited = set()       # O(1) membership test
    queue = deque([start])
    visited.add(start)
    while queue:
        node = queue.popleft()
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
```

## Best Practices

1. **Use sets for membership testing** — `x in my_set` is O(1) vs `x in my_list` which is O(n).
2. **Use `frozenset` (Python) for immutable sets** — can be used as dictionary keys or set elements.
3. **Prefer set operations over manual loops** — `a & b` is cleaner and often faster than manual iteration.
4. **Choose the right variant** — `HashSet` (unordered), `LinkedHashSet` (insertion order), `TreeSet` (sorted).
5. **Elements must be hashable** — in Python, only immutable types can be set elements.

## Anti-patterns / Common Mistakes

- **Using a list for membership testing** — O(n) per test vs O(1) for sets.
- **Mutable elements** — lists, dicts (Python), mutable objects (Java without proper hashCode) cannot be set elements.
- **Assuming order** — `HashSet` iteration order is not guaranteed; use `LinkedHashSet` or `TreeSet` if needed.
- **Converting to set just to check one element** — building a set is O(n); only worth it for repeated checks.

## Real-world Examples

- **Spam filters** — set of blocked email addresses or domains.
- **Visited tracking** — web crawlers track visited URLs with a set.
- **Feature flags** — set of enabled feature names.
- **Tagging systems** — each item's tags stored as a set for O(1) membership and set operations.
- **Database DISTINCT** — SQL `DISTINCT` uses a hash set internally.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Python set (docs.python.org)](https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset)
- [Java HashSet (Oracle)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashSet.html)
