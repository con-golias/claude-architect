# Heaps

> **Domain:** Fundamentals > Data Structures > Trees
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A heap is a **complete binary tree** stored as an array that satisfies the **heap property**: in a min-heap, every parent is smaller than or equal to its children; in a max-heap, every parent is larger than or equal to its children. The root always contains the minimum (or maximum) element, enabling O(1) access to the extreme value and O(log n) insertion and extraction.

## Why It Matters

- **Foundation of priority queues** — the standard implementation in every language.
- **Heapsort** — O(n log n) in-place sorting algorithm.
- **Graph algorithms** — Dijkstra's shortest path and Prim's MST depend on heaps.
- **Top-K problems** — efficiently maintain K largest/smallest elements in a stream.
- **Median finding** — two heaps (max + min) track the running median in O(log n).

## How It Works

### Heap Property

```
Min-Heap:               Max-Heap:
     1                       9
    / \                     / \
   3   2                   7   8
  / \ / \                 / \ / \
 7  4 5  6               3  4 5  6

Parent ≤ Children        Parent ≥ Children
```

### Array Representation

A complete binary tree maps perfectly to an array with no wasted space:

```
Min-Heap:     1
             / \
            3   2
           / \
          7   4

Array: [1, 3, 2, 7, 4]
Index:  0  1  2  3  4

For node at index i:
  Parent:      (i - 1) / 2
  Left child:  2i + 1
  Right child: 2i + 2
```

### Core Operations

```python
class MinHeap:
    def __init__(self):
        self.data = []

    def insert(self, value):
        """O(log n) — add element and bubble up."""
        self.data.append(value)
        self._bubble_up(len(self.data) - 1)

    def extract_min(self):
        """O(log n) — remove root and heapify down."""
        if not self.data:
            return None
        min_val = self.data[0]
        last = self.data.pop()
        if self.data:
            self.data[0] = last
            self._heapify_down(0)
        return min_val

    def peek(self):
        """O(1) — return root without removing."""
        return self.data[0] if self.data else None

    def _bubble_up(self, i):
        while i > 0:
            parent = (i - 1) // 2
            if self.data[i] < self.data[parent]:
                self.data[i], self.data[parent] = self.data[parent], self.data[i]
                i = parent
            else:
                break

    def _heapify_down(self, i):
        n = len(self.data)
        while True:
            smallest = i
            left = 2 * i + 1
            right = 2 * i + 2
            if left < n and self.data[left] < self.data[smallest]:
                smallest = left
            if right < n and self.data[right] < self.data[smallest]:
                smallest = right
            if smallest == i:
                break
            self.data[i], self.data[smallest] = self.data[smallest], self.data[i]
            i = smallest
```

### Build Heap — O(n) not O(n log n)

Building a heap from an unsorted array is O(n), not O(n log n):

```python
def build_heap(arr):
    """Floyd's algorithm — O(n) heap construction."""
    n = len(arr)
    # Start from last non-leaf node and heapify down
    for i in range(n // 2 - 1, -1, -1):
        heapify_down(arr, i, n)
```

The math: most nodes are near the bottom and require few swaps. The sum converges to O(n).

### Heapsort

```python
def heapsort(arr):
    """O(n log n) in-place sort using a max-heap."""
    n = len(arr)
    # Build max-heap
    for i in range(n // 2 - 1, -1, -1):
        heapify_down(arr, i, n)
    # Extract elements one by one
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]  # move max to end
        heapify_down(arr, 0, i)           # restore heap property
```

### Running Median (Two-Heap Technique)

```python
import heapq

class MedianFinder:
    def __init__(self):
        self.lo = []  # max-heap (negated) — lower half
        self.hi = []  # min-heap — upper half

    def add(self, num: int):
        heapq.heappush(self.lo, -num)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def median(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert | O(log n) | Bubble up |
| Extract min/max | O(log n) | Heapify down |
| Peek | O(1) | Return root |
| Build heap | O(n) | Floyd's algorithm |
| Heapsort | O(n log n) | In-place, not stable |
| Merge two heaps | O(n + m) | Build new heap |

## Best Practices

1. **Use library implementations** — `heapq` (Python), `PriorityQueue` (Java), `priority_queue` (C++).
2. **Build heap in O(n)** using Floyd's algorithm — don't insert one by one O(n log n).
3. **For max-heap in Python**, negate values: `heapq.heappush(h, -val)`.
4. **Use two heaps** for running median problems.
5. **Consider indexed heaps** when you need decrease-key for Dijkstra's algorithm.

## Anti-patterns / Common Mistakes

- **Assuming a heap is sorted** — only the root is guaranteed to be min/max.
- **Building by repeated insertion** — O(n log n) instead of O(n) with Floyd's algorithm.
- **Confusing heap with BST** — a heap doesn't maintain left < parent < right ordering.
- **Not using the right heap type** — min-heap for smallest, max-heap for largest.

## Real-world Examples

- **Priority queues** — task scheduling, event-driven simulation.
- **Dijkstra's algorithm** — extract minimum-distance node.
- **K-way merge** — merging K sorted lists (used in external sorting).
- **Memory allocation** — some allocators use heaps to track free blocks by size.
- **Streaming top-K** — maintain K largest elements from a data stream.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Floyd, R.W. (1964). "Algorithm 245: Treesort." *Communications of the ACM*.
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
