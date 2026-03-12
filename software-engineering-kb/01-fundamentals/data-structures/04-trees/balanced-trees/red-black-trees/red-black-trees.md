# Red-Black Trees

> **Domain:** Fundamentals > Data Structures > Trees > Balanced Trees
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A Red-Black tree is a self-balancing binary search tree where each node has an extra bit representing its "color" (red or black). The tree maintains balance through a set of color properties that guarantee the tree height is at most 2 × log₂(n+1), ensuring O(log n) worst-case time for all operations.

It is the **most widely used self-balancing BST** in practice — Java's `TreeMap`, C++'s `std::map`, and Linux's kernel scheduler all use Red-Black trees.

## Why It Matters

- **Guaranteed O(log n)** for search, insert, and delete — no degenerate cases.
- **Industry standard** — the default balanced BST in Java, C++, and many system libraries.
- **Fewer rotations** than AVL on insert/delete — better for write-heavy workloads.
- **Used in operating systems** — Linux's CFS scheduler, memory management, and file systems.

## How It Works

### The Five Properties

Every Red-Black tree satisfies these invariants:

1. Every node is either **red** or **black**.
2. The **root** is always **black**.
3. Every **leaf (null node)** is **black**.
4. If a node is **red**, both its children must be **black** (no two consecutive reds).
5. For each node, all paths from that node to descendant leaves contain the **same number of black nodes** (black-height).

```
         8(B)                B = Black node
        / \                  R = Red node
      4(R)  12(R)
      / \    / \
    2(B) 6(B) 10(B) 14(B)
    /
  1(R)

Black-height of root = 2 (count black nodes on any path to leaf)
```

### Why These Properties Guarantee Balance

Property 5 (equal black-height) combined with property 4 (no consecutive reds) means:
- The longest path (alternating red-black) is at most 2× the shortest path (all black).
- Therefore: height ≤ 2 × log₂(n+1)

### Insertion Algorithm

1. Insert as a regular BST (new node is always **red**).
2. Fix violations by recoloring and rotating:

```
Case 1: Uncle is RED → recolor parent, uncle, and grandparent
Case 2: Uncle is BLACK, node is inner child → rotate to make it outer child
Case 3: Uncle is BLACK, node is outer child → rotate grandparent + recolor

Example (Case 3 — Left-Left):
    G(B)              P(B)
   / \               / \
  P(R) U(B)   →    N(R) G(R)
 /                        \
N(R)                      U(B)
```

### Deletion Algorithm

Deletion is more complex — involves:
1. Standard BST deletion.
2. If the removed node was black, fix the "double black" violation.
3. Six cases (mirror-symmetric) of recoloring and rotation.

### Operations and Time Complexity

| Operation | Time | Rotations |
|-----------|------|-----------|
| Search | O(log n) | 0 |
| Insert | O(log n) | At most 2 |
| Delete | O(log n) | At most 3 |
| Min/Max | O(log n) | 0 |

### Language Implementations

```java
// Java — TreeMap and TreeSet use Red-Black trees internally
TreeMap<String, Integer> sortedMap = new TreeMap<>();
sortedMap.put("banana", 3);
sortedMap.put("apple", 5);
sortedMap.put("cherry", 1);

// Sorted iteration (guaranteed)
sortedMap.forEach((k, v) -> System.out.println(k));
// apple, banana, cherry

// Range queries
sortedMap.subMap("apple", "cherry");  // {apple=5, banana=3}
sortedMap.firstKey();                  // "apple"
sortedMap.lastKey();                   // "cherry"
sortedMap.floorKey("b");              // "banana"
sortedMap.ceilingKey("b");            // "banana"
```

```cpp
// C++ — std::map and std::set use Red-Black trees
std::map<std::string, int> sortedMap;
sortedMap["banana"] = 3;
sortedMap["apple"] = 5;

// Sorted iteration
for (auto& [key, value] : sortedMap) {
    // apple: 5, banana: 3 (sorted by key)
}

// Lower/upper bound
auto it = sortedMap.lower_bound("b");  // points to "banana"
```

### Red-Black vs AVL vs Skip List

| Property | Red-Black | AVL | Skip List |
|----------|-----------|-----|-----------|
| Search | O(log n) | O(log n) — faster | O(log n) expected |
| Insert | O(log n) — faster | O(log n) | O(log n) expected |
| Delete | O(log n) — faster | O(log n) | O(log n) expected |
| Implementation | Complex | Moderate | Simple |
| Concurrent use | Hard | Hard | Easy (lock-free possible) |

## Best Practices

1. **Use `TreeMap`/`TreeSet` (Java) or `std::map`/`std::set` (C++)** — don't implement from scratch.
2. **Choose Red-Black over AVL** for general-purpose use — better insert/delete performance.
3. **Use when you need sorted operations** — range queries, predecessor/successor, ordered iteration.
4. **Prefer hash maps for unordered lookups** — O(1) average vs O(log n).

## Anti-patterns / Common Mistakes

- **Implementing from scratch** — Red-Black tree insertion/deletion is notoriously error-prone.
- **Using when order doesn't matter** — hash maps are faster for pure key-value lookups.
- **Assuming O(1) lookup** — Red-Black trees are O(log n), not O(1).
- **Not leveraging range operations** — if you only use get/put, a hash map is better.

## Real-world Examples

- **Java's `TreeMap`/`TreeSet`** — the standard sorted collection implementation.
- **C++'s `std::map`/`std::set`** — Red-Black tree in most implementations (GCC, Clang, MSVC).
- **Linux CFS scheduler** — the Completely Fair Scheduler uses a Red-Black tree of tasks.
- **Epoll** — Linux's epoll uses Red-Black trees to track file descriptors.
- **Java 8 HashMap** — long collision chains (8+) are converted to Red-Black trees.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Wikipedia — Red-Black Tree](https://en.wikipedia.org/wiki/Red%E2%80%93black_tree)
- [Baeldung — Red-Black Tree vs AVL Tree](https://www.baeldung.com/cs/red-black-tree-vs-avl-tree)
