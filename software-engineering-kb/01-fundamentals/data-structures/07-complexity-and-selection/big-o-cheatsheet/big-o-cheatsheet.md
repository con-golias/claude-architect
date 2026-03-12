# Big O Cheat Sheet

> **Domain:** Fundamentals > Data Structures > Complexity and Selection
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Big O notation describes the upper bound of an algorithm's time or space complexity as input size grows. It answers: **"How does performance scale?"** — not the exact runtime, but the growth rate.

## Why It Matters

- **Predicts scalability** — an O(n^2) algorithm that works on 1,000 items will choke on 1,000,000.
- **Guides data structure selection** — choosing the right structure for your access patterns.
- **Interview essential** — virtually every coding interview asks about time/space complexity.
- **Architecture decisions** — O(1) vs O(n) vs O(n^2) determines system design choices.

## Common Growth Rates

```
Rate        | Name          | 10      | 100       | 1,000       | 1,000,000
────────────|───────────────|─────────|───────────|─────────────|──────────────
O(1)        | Constant      | 1       | 1         | 1           | 1
O(log n)    | Logarithmic   | 3       | 7         | 10          | 20
O(n)        | Linear        | 10      | 100       | 1,000       | 1,000,000
O(n log n)  | Linearithmic  | 33      | 664       | 9,966       | 19,931,568
O(n²)       | Quadratic     | 100     | 10,000    | 1,000,000   | 10¹²
O(n³)       | Cubic         | 1,000   | 1,000,000 | 10⁹         | 10¹⁸
O(2ⁿ)       | Exponential   | 1,024   | 10³⁰      | 10³⁰¹      | ∞
O(n!)       | Factorial     | 3.6M    | 10¹⁵⁸     | ∞           | ∞
```

### Visual Comparison

```
Time
  │
  │                                              O(2ⁿ)
  │                                         ╱
  │                                    ╱
  │                              O(n²)
  │                         ╱
  │                   ╱
  │            O(n log n)
  │         ╱
  │      O(n)
  │    ╱
  │  O(log n)
  │──────────────────────────── O(1)
  └────────────────────────────── Input size (n)
```

## Data Structures Complexity

### Arrays / Lists

| Operation | Array | Dynamic Array | Singly Linked | Doubly Linked |
|-----------|-------|--------------|---------------|---------------|
| Access by index | O(1) | O(1) | O(n) | O(n) |
| Insert at beginning | O(n) | O(n) | O(1) | O(1) |
| Insert at end | N/A | O(1)* | O(n)† | O(1) |
| Insert at middle | O(n) | O(n) | O(n) | O(n) |
| Delete at beginning | O(n) | O(n) | O(1) | O(1) |
| Delete at end | N/A | O(1) | O(n) | O(1) |
| Search | O(n) | O(n) | O(n) | O(n) |

*Amortized. †O(1) with tail pointer.

### Stacks and Queues

| Operation | Stack | Queue | Deque | Priority Queue |
|-----------|-------|-------|-------|----------------|
| Push / Enqueue | O(1) | O(1) | O(1) | O(log n) |
| Pop / Dequeue | O(1) | O(1) | O(1) | O(log n) |
| Peek | O(1) | O(1) | O(1) | O(1) |
| Search | O(n) | O(n) | O(n) | O(n) |

### Hash-Based

| Operation | Hash Table (avg) | Hash Table (worst) | Hash Set (avg) |
|-----------|-----------------|-------------------|---------------|
| Insert | O(1) | O(n) | O(1) |
| Delete | O(1) | O(n) | O(1) |
| Search | O(1) | O(n) | O(1) |
| Space | O(n) | O(n) | O(n) |

### Trees

| Operation | BST (avg) | BST (worst) | AVL | Red-Black | B-tree |
|-----------|-----------|-------------|-----|-----------|--------|
| Search | O(log n) | O(n) | O(log n) | O(log n) | O(log n) |
| Insert | O(log n) | O(n) | O(log n) | O(log n) | O(log n) |
| Delete | O(log n) | O(n) | O(log n) | O(log n) | O(log n) |
| Min/Max | O(log n) | O(n) | O(log n) | O(log n) | O(log n) |

### Advanced

| Structure | Insert | Search/Query | Delete | Space |
|-----------|--------|-------------|--------|-------|
| Trie | O(m)* | O(m) | O(m) | O(n × m) |
| Bloom filter | O(k)† | O(k) | N/A | O(m) |
| Skip list | O(log n) | O(log n) | O(log n) | O(n) |
| Union-Find | O(α(n)) | O(α(n)) | N/A | O(n) |
| Segment tree | O(log n) | O(log n) | N/A | O(n) |
| Fenwick tree | O(log n) | O(log n) | N/A | O(n) |

*m = key length. †k = number of hash functions.

## Sorting Algorithms

| Algorithm | Best | Average | Worst | Space | Stable |
|-----------|------|---------|-------|-------|--------|
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | No |
| Insertion sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick sort | O(n log n) | O(n log n) | O(n²) | O(log n) | No |
| Heap sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |
| Counting sort | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes |
| Radix sort | O(nk) | O(nk) | O(nk) | O(n + k) | Yes |

## Rules of Thumb

```
O(1):        Hash table lookup, array access
O(log n):    Binary search, balanced tree operations
O(n):        Linear scan, single loop
O(n log n):  Efficient sorting (merge, quick, heap)
O(n²):       Nested loops, naive sorting
O(2ⁿ):       Subsets, recursive backtracking
O(n!):       Permutations, brute-force TSP

Practical limits (1 second, ~10⁸ operations):
n ≤ 10:      O(n!) is fine
n ≤ 20:      O(2ⁿ) is fine
n ≤ 500:     O(n³) is fine
n ≤ 5,000:   O(n²) is fine
n ≤ 10⁶:     O(n log n) is needed
n ≤ 10⁸:     O(n) is needed
n > 10⁸:     O(log n) or O(1) is needed
```

## Amortized Analysis

Some operations are occasionally expensive but cheap on average:

```
Dynamic array append:
- Usually O(1)
- Occasionally O(n) when resizing
- Amortized: O(1) per operation

Hash table insert:
- Usually O(1)
- Occasionally O(n) when rehashing
- Amortized: O(1) per operation
```

## Space Complexity

```
O(1):    Fixed number of variables
O(log n): Recursive call stack (balanced tree traversal)
O(n):    Linear data structure, hash table, single array copy
O(n²):   2D matrix, adjacency matrix
O(2ⁿ):   All subsets
```

## Sources

- [Big-O Cheat Sheet (bigocheatsheet.com)](https://www.bigocheatsheet.com/)
- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Python TimeComplexity (wiki.python.org)](https://wiki.python.org/moin/TimeComplexity)
- [GeeksforGeeks — Big O Notation](https://www.geeksforgeeks.org/analysis-algorithms-big-o-analysis/)
