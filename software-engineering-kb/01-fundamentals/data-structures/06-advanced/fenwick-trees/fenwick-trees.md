# Fenwick Trees (Binary Indexed Trees)

> **Domain:** Fundamentals > Data Structures > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A Fenwick tree (Binary Indexed Tree / BIT) is a data structure that provides O(log n) prefix sum queries and O(log n) point updates. It is simpler to implement and uses less memory than a segment tree, though it is less flexible (primarily designed for prefix sums and cumulative frequency tables).

Invented by Peter Fenwick in 1994.

## Why It Matters

- **Simpler than segment trees** — only ~10 lines of code for the core implementation.
- **Less memory** — uses exactly n+1 elements (vs 4n for segment trees).
- **Fast prefix sums with updates** — O(log n) for both, vs O(n) update with naive prefix sums.
- **Competitive programming favorite** — inversion counting, range sum, frequency counting.

## How It Works

### Key Insight: Binary Representation

The Fenwick tree exploits the binary representation of indices. Each position i is responsible for a range of elements determined by the lowest set bit of i:

```
Index (binary): Range covered
1  (0001):      [1, 1]     ← covers 1 element
2  (0010):      [1, 2]     ← covers 2 elements
3  (0011):      [3, 3]     ← covers 1 element
4  (0100):      [1, 4]     ← covers 4 elements
5  (0101):      [5, 5]     ← covers 1 element
6  (0110):      [5, 6]     ← covers 2 elements
7  (0111):      [7, 7]     ← covers 1 element
8  (1000):      [1, 8]     ← covers 8 elements

Lowest set bit (LSB) of i = i & (-i)
```

### Visual Structure

```
Array:    [_, 1, 3, 2, 5, 4, 7, 6, 8]  (1-indexed)
BIT:      [_, 1, 4, 2, 10, 4, 11, 6, 36]

BIT[1] = arr[1] = 1
BIT[2] = arr[1] + arr[2] = 4
BIT[3] = arr[3] = 2
BIT[4] = arr[1] + arr[2] + arr[3] + arr[4] = 10
BIT[5] = arr[5] = 4
BIT[6] = arr[5] + arr[6] = 11
BIT[7] = arr[7] = 6
BIT[8] = arr[1] + ... + arr[8] = 36

Prefix sum(6) = BIT[6] + BIT[4] = 11 + 10 = 21 ✓
  6 = 110 → strip LSB → 4 = 100 → strip LSB → 0 (stop)
```

### Implementation

```python
class FenwickTree:
    def __init__(self, n: int):
        self.n = n
        self.tree = [0] * (n + 1)  # 1-indexed

    def update(self, i: int, delta: int):
        """O(log n) — add delta to element at index i."""
        while i <= self.n:
            self.tree[i] += delta
            i += i & (-i)  # add lowest set bit

    def prefix_sum(self, i: int) -> int:
        """O(log n) — sum of elements [1..i]."""
        total = 0
        while i > 0:
            total += self.tree[i]
            i -= i & (-i)  # remove lowest set bit
        return total

    def range_sum(self, left: int, right: int) -> int:
        """O(log n) — sum of elements [left..right]."""
        return self.prefix_sum(right) - self.prefix_sum(left - 1)

    @classmethod
    def from_array(cls, arr: list[int]) -> 'FenwickTree':
        """O(n) — build from array."""
        n = len(arr)
        ft = cls(n)
        ft.tree[1:] = arr[:]
        for i in range(1, n + 1):
            parent = i + (i & (-i))
            if parent <= n:
                ft.tree[parent] += ft.tree[i]
        return ft
```

```java
class FenwickTree {
    private int[] tree;
    private int n;

    public FenwickTree(int n) {
        this.n = n;
        this.tree = new int[n + 1];
    }

    public void update(int i, int delta) {
        for (; i <= n; i += i & (-i))
            tree[i] += delta;
    }

    public int prefixSum(int i) {
        int sum = 0;
        for (; i > 0; i -= i & (-i))
            sum += tree[i];
        return sum;
    }

    public int rangeSum(int left, int right) {
        return prefixSum(right) - prefixSum(left - 1);
    }
}
```

### Counting Inversions (Classic Application)

```python
def count_inversions(arr: list[int]) -> int:
    """Count inversions in O(n log n) using a Fenwick tree."""
    # Coordinate compression
    sorted_unique = sorted(set(arr))
    rank = {v: i + 1 for i, v in enumerate(sorted_unique)}

    ft = FenwickTree(len(sorted_unique))
    inversions = 0

    for val in reversed(arr):
        inversions += ft.prefix_sum(rank[val] - 1)  # count smaller elements seen so far
        ft.update(rank[val], 1)

    return inversions
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Point update | O(log n) | Add delta to index |
| Prefix sum | O(log n) | Sum of [1..i] |
| Range sum | O(log n) | prefix(right) - prefix(left-1) |
| Build from array | O(n) | Linear construction |
| Space | O(n) | Exactly n+1 elements |

### Fenwick Tree vs Segment Tree

| Property | Fenwick Tree | Segment Tree |
|----------|-------------|-------------|
| Implementation | ~10 lines | ~50 lines |
| Memory | n + 1 | 4n |
| Point update | O(log n) | O(log n) |
| Prefix/range sum | O(log n) | O(log n) |
| Range update | O(log n)* | O(log n) with lazy |
| Arbitrary range query | Limited | Flexible (min, max, GCD) |
| Flexibility | Sum/XOR only | Any associative operation |

*With a secondary Fenwick tree.

## Best Practices

1. **Use 1-based indexing** — Fenwick trees are naturally 1-indexed.
2. **Use for prefix sums with updates** — the sweet spot for Fenwick trees.
3. **Prefer over segment trees when only prefix sums are needed** — simpler and more memory-efficient.
4. **Use segment trees for min/max queries** — Fenwick trees only support invertible operations (sum, XOR).
5. **Coordinate compression** — for large value ranges, compress to [1..n] first.

## Anti-patterns / Common Mistakes

- **0-based indexing** — i & (-i) is 0 when i is 0, causing infinite loops.
- **Using for min/max queries** — Fenwick trees only work with invertible operations (sum, XOR), not min/max.
- **Forgetting coordinate compression** — for values up to 10^9, compress to [1..n].
- **Not realizing range sums are derived** — `range(l, r) = prefix(r) - prefix(l-1)`.

## Real-world Examples

- **Inversion counting** — count out-of-order pairs in a sequence.
- **Cumulative frequency tables** — the original motivation for Fenwick's invention.
- **2D prefix sums with updates** — extend to 2D for matrix region sum queries.
- **Competitive programming** — frequently used for range sum and inversion problems.

## Sources

- Fenwick, P.M. (1994). "A New Data Structure for Cumulative Frequency Tables."
- [CP-Algorithms — Fenwick Tree](https://cp-algorithms.com/data_structures/fenwick.html)
- [GeeksforGeeks — Binary Indexed Tree](https://www.geeksforgeeks.org/binary-indexed-tree-or-fenwick-tree-2/)
