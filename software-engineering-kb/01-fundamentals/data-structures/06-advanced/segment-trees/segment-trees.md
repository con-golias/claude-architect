# Segment Trees

> **Domain:** Fundamentals > Data Structures > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A segment tree is a binary tree used for storing information about intervals (segments) of an array. It allows efficient **range queries** (sum, min, max, GCD over a range) and **point updates** in O(log n) time — much faster than the naive O(n) approach of scanning the range each time.

## Why It Matters

- **O(log n) range queries** — sum, min, max, GCD, XOR over any subarray.
- **O(log n) point updates** — update a single element and propagate changes.
- **Competitive programming essential** — one of the most commonly used advanced data structures.
- **Database query optimization** — underlies certain aggregate query optimizations.

## How It Works

### Structure

```
Array: [2, 1, 5, 3, 4, 7]

Segment tree for range sum:
              [22]           ← sum of [0..5]
            /      \
         [8]       [14]      ← sum of [0..2], [3..5]
        /   \     /    \
      [3]   [5] [7]    [7]   ← sum of [0..1], [2..2], [3..4], [5..5]
     / \        / \
   [2] [1]    [3] [4]        ← individual elements

Query sum(1, 4) = ?
→ Decompose [1..4] into tree segments: [1..2] + [3..4]
→ 1 + 5 + 3 + 4 = 13 (answered in O(log n) steps)
```

### Implementation

```python
class SegmentTree:
    def __init__(self, data: list[int]):
        self.n = len(data)
        self.tree = [0] * (4 * self.n)  # 4n space is safe upper bound
        self._build(data, 1, 0, self.n - 1)

    def _build(self, data, node, start, end):
        """O(n) — build the tree from array."""
        if start == end:
            self.tree[node] = data[start]
        else:
            mid = (start + end) // 2
            self._build(data, 2 * node, start, mid)
            self._build(data, 2 * node + 1, mid + 1, end)
            self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def update(self, index: int, value: int):
        """O(log n) — update element at index."""
        self._update(1, 0, self.n - 1, index, value)

    def _update(self, node, start, end, index, value):
        if start == end:
            self.tree[node] = value
        else:
            mid = (start + end) // 2
            if index <= mid:
                self._update(2 * node, start, mid, index, value)
            else:
                self._update(2 * node + 1, mid + 1, end, index, value)
            self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def query(self, left: int, right: int) -> int:
        """O(log n) — range sum query [left, right]."""
        return self._query(1, 0, self.n - 1, left, right)

    def _query(self, node, start, end, left, right):
        if right < start or end < left:
            return 0  # identity element for sum
        if left <= start and end <= right:
            return self.tree[node]  # completely within range
        mid = (start + end) // 2
        return (self._query(2 * node, start, mid, left, right) +
                self._query(2 * node + 1, mid + 1, end, left, right))

# Usage
st = SegmentTree([2, 1, 5, 3, 4, 7])
st.query(1, 4)   # sum of indices 1..4 = 1+5+3+4 = 13
st.update(2, 10) # change index 2 from 5 to 10
st.query(1, 4)   # now 1+10+3+4 = 18
```

### Lazy Propagation (Range Updates)

For range updates (e.g., add 5 to all elements in [2, 5]), lazy propagation defers updates:

```python
class LazySegmentTree:
    def __init__(self, n: int):
        self.n = n
        self.tree = [0] * (4 * n)
        self.lazy = [0] * (4 * n)

    def _push_down(self, node, start, end):
        """Propagate pending updates to children."""
        if self.lazy[node] != 0:
            mid = (start + end) // 2
            self._apply(2 * node, start, mid, self.lazy[node])
            self._apply(2 * node + 1, mid + 1, end, self.lazy[node])
            self.lazy[node] = 0

    def _apply(self, node, start, end, value):
        self.tree[node] += value * (end - start + 1)
        self.lazy[node] += value

    def range_update(self, left, right, value):
        """O(log n) — add value to all elements in [left, right]."""
        self._range_update(1, 0, self.n - 1, left, right, value)

    def _range_update(self, node, start, end, left, right, value):
        if right < start or end < left:
            return
        if left <= start and end <= right:
            self._apply(node, start, end, value)
            return
        self._push_down(node, start, end)
        mid = (start + end) // 2
        self._range_update(2 * node, start, mid, left, right, value)
        self._range_update(2 * node + 1, mid + 1, end, left, right, value)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Build | O(n) | Bottom-up construction |
| Point query | O(log n) | Single element |
| Range query | O(log n) | Sum/min/max over range |
| Point update | O(log n) | Update single element |
| Range update | O(log n) | With lazy propagation |
| Space | O(n) | 4n array |

### Segment Tree vs Alternatives

| Structure | Point Update | Range Query | Range Update | Build |
|-----------|-------------|-------------|-------------|-------|
| Array | O(1) | O(n) | O(n) | O(n) |
| Prefix sum | O(n) | O(1) | O(n) | O(n) |
| Segment tree | O(log n) | O(log n) | O(log n)* | O(n) |
| Fenwick tree | O(log n) | O(log n) | O(log n) | O(n) |

*With lazy propagation.

## Best Practices

1. **Use 4n array size** — a safe upper bound for the tree array.
2. **Choose the right identity element** — 0 for sum, ∞ for min, -∞ for max.
3. **Use lazy propagation** for range updates — without it, range updates are O(n).
4. **Consider Fenwick trees** for simpler prefix sum queries — less code, same complexity.
5. **Use iterative implementation** for better cache performance in competitive programming.

## Anti-patterns / Common Mistakes

- **Off-by-one errors** — segment boundaries are the most common source of bugs.
- **Not using lazy propagation for range updates** — leads to O(n) per update.
- **Using segment trees when prefix sums suffice** — if there are no updates, prefix sums are O(1).
- **Incorrect identity element** — using 0 for min queries produces wrong results.

## Real-world Examples

- **Competitive programming** — range minimum/maximum/sum queries.
- **Database query optimization** — aggregate queries over ranges.
- **Computational geometry** — rectangle intersection, sweep line algorithms.
- **Interval scheduling** — finding conflicts in time intervals.
- **Image processing** — 2D segment trees for rectangular region queries.

## Sources

- [CP-Algorithms — Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html)
- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
