# Advanced Tree Structures

> **Domain:** Fundamentals > Algorithms > Tree > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

Beyond basic Binary Search Trees, specialized tree structures solve specific problems with
optimal time complexity. These include:

- **Segment Trees** -- range queries and updates in O(log n)
- **Fenwick Trees (BIT)** -- prefix sums and point updates in O(log n) with minimal code
- **Tries** -- prefix-based string operations in O(m) per key
- **Lowest Common Ancestor** -- ancestor queries in O(1) after preprocessing
- **B-Trees / B+ Trees** -- disk-oriented balanced trees for databases and file systems

These structures appear constantly in competitive programming, database internals, and systems
programming.

---

## Segment Tree

A segment tree is a binary tree where each node represents an interval (segment) of an array.
It supports **range queries** (sum, min, max, GCD, etc.) and **point/range updates** in
O(log n) time.

### Structure

For array `A = [1, 3, 5, 7, 9, 11]`:

```
                        [0-5] = 36
                       /          \
               [0-2] = 9          [3-5] = 27
              /        \          /         \
         [0-1] = 4    [2] = 5  [3-4] = 16   [5] = 11
         /     \                /      \
      [0] = 1  [1] = 3     [3] = 7  [4] = 9

  Array indices:  0   1   2   3   4   5
  Array values:   1   3   5   7   9   11
```

Each leaf holds one array element. Each internal node holds the aggregate (here: sum) of its
children's range.

### Implementation (Python) -- Range Sum with Point Update

```python
class SegmentTree:
    """Segment tree for range sum queries and point updates."""

    def __init__(self, data: list[int]):
        self.n = len(data)
        self.tree = [0] * (4 * self.n)  # 4n is safe upper bound
        if self.n > 0:
            self._build(data, 1, 0, self.n - 1)

    def _build(self, data: list[int], node: int, start: int, end: int) -> None:
        """Build the segment tree recursively. O(n)."""
        if start == end:
            self.tree[node] = data[start]
            return

        mid = (start + end) // 2
        self._build(data, 2 * node, start, mid)
        self._build(data, 2 * node + 1, mid + 1, end)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def update(self, idx: int, val: int) -> None:
        """Set A[idx] = val and update the tree. O(log n)."""
        self._update(1, 0, self.n - 1, idx, val)

    def _update(self, node: int, start: int, end: int, idx: int, val: int) -> None:
        if start == end:
            self.tree[node] = val
            return

        mid = (start + end) // 2
        if idx <= mid:
            self._update(2 * node, start, mid, idx, val)
        else:
            self._update(2 * node + 1, mid + 1, end, idx, val)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def query(self, left: int, right: int) -> int:
        """Return sum of A[left..right]. O(log n)."""
        return self._query(1, 0, self.n - 1, left, right)

    def _query(self, node: int, start: int, end: int, left: int, right: int) -> int:
        if right < start or end < left:
            return 0  # Out of range
        if left <= start and end <= right:
            return self.tree[node]  # Fully within range

        mid = (start + end) // 2
        left_sum = self._query(2 * node, start, mid, left, right)
        right_sum = self._query(2 * node + 1, mid + 1, end, left, right)
        return left_sum + right_sum


# Usage
data = [1, 3, 5, 7, 9, 11]
st = SegmentTree(data)

print(st.query(1, 3))   # 3 + 5 + 7 = 15
print(st.query(0, 5))   # 1 + 3 + 5 + 7 + 9 + 11 = 36
print(st.query(2, 4))   # 5 + 7 + 9 = 21

st.update(2, 10)         # Change A[2] from 5 to 10
print(st.query(1, 3))   # 3 + 10 + 7 = 20
print(st.query(0, 5))   # 1 + 3 + 10 + 7 + 9 + 11 = 41
```

### Implementation (TypeScript)

```typescript
class SegmentTree {
    private tree: number[];
    private n: number;

    constructor(data: number[]) {
        this.n = data.length;
        this.tree = new Array(4 * this.n).fill(0);
        if (this.n > 0) {
            this.build(data, 1, 0, this.n - 1);
        }
    }

    private build(data: number[], node: number, start: number, end: number): void {
        if (start === end) {
            this.tree[node] = data[start];
            return;
        }
        const mid = Math.floor((start + end) / 2);
        this.build(data, 2 * node, start, mid);
        this.build(data, 2 * node + 1, mid + 1, end);
        this.tree[node] = this.tree[2 * node] + this.tree[2 * node + 1];
    }

    update(idx: number, val: number): void {
        this.updateHelper(1, 0, this.n - 1, idx, val);
    }

    private updateHelper(node: number, start: number, end: number, idx: number, val: number): void {
        if (start === end) {
            this.tree[node] = val;
            return;
        }
        const mid = Math.floor((start + end) / 2);
        if (idx <= mid) {
            this.updateHelper(2 * node, start, mid, idx, val);
        } else {
            this.updateHelper(2 * node + 1, mid + 1, end, idx, val);
        }
        this.tree[node] = this.tree[2 * node] + this.tree[2 * node + 1];
    }

    query(left: number, right: number): number {
        return this.queryHelper(1, 0, this.n - 1, left, right);
    }

    private queryHelper(node: number, start: number, end: number, left: number, right: number): number {
        if (right < start || end < left) return 0;
        if (left <= start && end <= right) return this.tree[node];
        const mid = Math.floor((start + end) / 2);
        return this.queryHelper(2 * node, start, mid, left, right) +
               this.queryHelper(2 * node + 1, mid + 1, end, left, right);
    }
}

// Usage
const st = new SegmentTree([1, 3, 5, 7, 9, 11]);
console.log(st.query(1, 3));  // 15
st.update(2, 10);
console.log(st.query(1, 3));  // 20
```

### Lazy Propagation (Range Updates)

When we need to update an entire range (e.g., add `val` to all elements in `[l, r]`), naive
approach is O(n log n). Lazy propagation defers updates to children, achieving O(log n) per
range update.

```python
class LazySegmentTree:
    """Segment tree with lazy propagation for range add + range sum."""

    def __init__(self, data: list[int]):
        self.n = len(data)
        self.tree = [0] * (4 * self.n)
        self.lazy = [0] * (4 * self.n)
        if self.n > 0:
            self._build(data, 1, 0, self.n - 1)

    def _build(self, data: list[int], node: int, start: int, end: int) -> None:
        if start == end:
            self.tree[node] = data[start]
            return
        mid = (start + end) // 2
        self._build(data, 2 * node, start, mid)
        self._build(data, 2 * node + 1, mid + 1, end)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def _push_down(self, node: int, start: int, end: int) -> None:
        """Propagate lazy value to children."""
        if self.lazy[node] != 0:
            mid = (start + end) // 2
            left_count = mid - start + 1
            right_count = end - mid

            self.tree[2 * node] += self.lazy[node] * left_count
            self.lazy[2 * node] += self.lazy[node]

            self.tree[2 * node + 1] += self.lazy[node] * right_count
            self.lazy[2 * node + 1] += self.lazy[node]

            self.lazy[node] = 0

    def range_update(self, left: int, right: int, val: int) -> None:
        """Add val to all elements in [left, right]. O(log n)."""
        self._range_update(1, 0, self.n - 1, left, right, val)

    def _range_update(self, node: int, start: int, end: int,
                      left: int, right: int, val: int) -> None:
        if right < start or end < left:
            return
        if left <= start and end <= right:
            self.tree[node] += val * (end - start + 1)
            self.lazy[node] += val
            return

        self._push_down(node, start, end)
        mid = (start + end) // 2
        self._range_update(2 * node, start, mid, left, right, val)
        self._range_update(2 * node + 1, mid + 1, end, left, right, val)
        self.tree[node] = self.tree[2 * node] + self.tree[2 * node + 1]

    def query(self, left: int, right: int) -> int:
        """Return sum of [left, right]. O(log n)."""
        return self._query(1, 0, self.n - 1, left, right)

    def _query(self, node: int, start: int, end: int, left: int, right: int) -> int:
        if right < start or end < left:
            return 0
        if left <= start and end <= right:
            return self.tree[node]

        self._push_down(node, start, end)
        mid = (start + end) // 2
        return (self._query(2 * node, start, mid, left, right) +
                self._query(2 * node + 1, mid + 1, end, left, right))


# Usage
data = [1, 3, 5, 7, 9, 11]
lst = LazySegmentTree(data)

print(lst.query(1, 4))        # 3+5+7+9 = 24
lst.range_update(1, 3, 10)    # Add 10 to A[1..3]
print(lst.query(1, 4))        # 13+15+17+9 = 54
```

### Segment Tree Complexity

| Operation          | Time     | Space  |
|--------------------|----------|--------|
| Build              | O(n)     | O(4n)  |
| Point update       | O(log n) | O(1)   |
| Range query        | O(log n) | O(1)   |
| Range update (lazy)| O(log n) | O(4n)  |

**Applications:** Range sum/min/max queries, counting inversions, rectangle union area,
2D range queries, persistent segment trees for version control, competitive programming.

---

## Fenwick Tree (Binary Indexed Tree)

A Fenwick tree (BIT) supports **prefix sum queries** and **point updates** in O(log n). It is
simpler to implement and uses less memory than a segment tree, but supports fewer types of
queries.

### Key Insight: The Lowbit Trick

The magic of Fenwick trees lies in the function `lowbit(i) = i & (-i)`, which isolates the
lowest set bit. This determines the range of elements each position is responsible for.

```
Index (1-based):   1    2    3    4    5    6    7    8
Binary:          001  010  011  100  101  110  111  1000
lowbit:            1    2    1    4    1    2    1    8
Responsible for: [1]  [1-2] [3] [1-4] [5] [5-6] [7] [1-8]

Tree structure (each node covers a range):

  Index:  1     2     3     4     5     6     7     8
          |     |     |     |     |     |     |     |
          +--+--+     |     +--+--+     |     |     |
             |        |        |        |     |     |
             +---+----+        +---+----+     |     |
                 |                 |           |     |
                 +--------+-------+           |     |
                          |                   |     |
                          +----------+--------+     |
                                     |              |
                                     +---------+----+
                                               |
```

### Implementation (Python)

```python
class FenwickTree:
    """Binary Indexed Tree for prefix sums and point updates."""

    def __init__(self, n: int):
        """Initialize with n elements, all zero."""
        self.n = n
        self.tree = [0] * (n + 1)  # 1-indexed

    @classmethod
    def from_array(cls, data: list[int]) -> 'FenwickTree':
        """Build from existing array. O(n)."""
        ft = cls(len(data))
        for i, val in enumerate(data):
            ft.update(i, val)
        return ft

    def update(self, idx: int, delta: int) -> None:
        """Add delta to element at idx (0-indexed). O(log n)."""
        idx += 1  # Convert to 1-indexed
        while idx <= self.n:
            self.tree[idx] += delta
            idx += idx & (-idx)  # Move to parent

    def prefix_sum(self, idx: int) -> int:
        """Return sum of elements [0, idx]. O(log n)."""
        idx += 1  # Convert to 1-indexed
        total = 0
        while idx > 0:
            total += self.tree[idx]
            idx -= idx & (-idx)  # Move to responsible ancestor
        return total

    def range_sum(self, left: int, right: int) -> int:
        """Return sum of elements [left, right]. O(log n)."""
        if left == 0:
            return self.prefix_sum(right)
        return self.prefix_sum(right) - self.prefix_sum(left - 1)


# Usage
data = [1, 3, 5, 7, 9, 11]
ft = FenwickTree.from_array(data)

print(ft.prefix_sum(3))     # 1+3+5+7 = 16
print(ft.range_sum(1, 4))   # 3+5+7+9 = 24

ft.update(2, 5)              # Add 5 to A[2]: now A[2] = 10
print(ft.prefix_sum(3))     # 1+3+10+7 = 21
```

### Implementation (TypeScript)

```typescript
class FenwickTree {
    private tree: number[];
    private n: number;

    constructor(n: number) {
        this.n = n;
        this.tree = new Array(n + 1).fill(0);
    }

    static fromArray(data: number[]): FenwickTree {
        const ft = new FenwickTree(data.length);
        for (let i = 0; i < data.length; i++) {
            ft.update(i, data[i]);
        }
        return ft;
    }

    update(idx: number, delta: number): void {
        idx += 1; // 1-indexed
        while (idx <= this.n) {
            this.tree[idx] += delta;
            idx += idx & (-idx);
        }
    }

    prefixSum(idx: number): number {
        idx += 1; // 1-indexed
        let total = 0;
        while (idx > 0) {
            total += this.tree[idx];
            idx -= idx & (-idx);
        }
        return total;
    }

    rangeSum(left: number, right: number): number {
        if (left === 0) return this.prefixSum(right);
        return this.prefixSum(right) - this.prefixSum(left - 1);
    }
}

// Usage
const ft = FenwickTree.fromArray([1, 3, 5, 7, 9, 11]);
console.log(ft.rangeSum(1, 4));  // 24
ft.update(2, 5);
console.log(ft.prefixSum(3));    // 21
```

### Fenwick vs Segment Tree

| Aspect              | Fenwick Tree         | Segment Tree          |
|---------------------|----------------------|-----------------------|
| Implementation      | Very simple (~15 LOC)| Moderate (~50 LOC)    |
| Space               | O(n)                 | O(4n)                 |
| Point update        | O(log n)             | O(log n)              |
| Prefix query        | O(log n)             | O(log n)              |
| Arbitrary range     | O(log n) via diff    | O(log n)              |
| Range update        | Possible (2 BITs)    | O(log n) with lazy    |
| Range min/max       | Not supported        | O(log n)              |
| Constant factor     | Very small           | Moderate              |

**Rule of thumb:** Use Fenwick for prefix sums; use Segment Tree for min/max or complex queries.

---

## Trie (Prefix Tree) -- Brief

Detailed coverage is in the String Algorithms chapter. Key points:

### Compressed Trie (Radix Tree / Patricia Tree)

A compressed trie merges chains of single-child nodes into one edge, reducing space.

```
Standard Trie:              Compressed Trie (Radix Tree):

      (root)                      (root)
      /    \                      /    \
     t      b                   te     bi
    / \      \                 / \      \
   e   o      i              a   n     ke
  / \   \      \                  |
 a   n   p      k                 s
     |          |
     s          e

Words: tea, ten, tens, to, top, bike
```

**Space reduction:** Compressed tries use O(n) space where n = number of stored strings,
compared to O(total_chars) for standard tries.

**Real-world usage:** Linux kernel routing tables, HTTP routers (e.g., Go's `httprouter`),
IP address lookup, associative arrays.

---

## Lowest Common Ancestor (LCA)

The Lowest Common Ancestor of two nodes `u` and `v` in a tree is the deepest node that is an
ancestor of both `u` and `v`.

```
              1
            / | \
           2  3  4
          / \    |
         5   6   7
        /
       8

  LCA(5, 6) = 2
  LCA(8, 6) = 2
  LCA(5, 7) = 1
  LCA(8, 4) = 1
```

### Approach 1: Naive (Binary Tree) -- O(n) per query

```python
class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def lca_binary_tree(root: TreeNode | None, p: TreeNode, q: TreeNode) -> TreeNode | None:
    """Find LCA in a binary tree. O(n) time, O(h) space."""
    if root is None or root == p or root == q:
        return root

    left = lca_binary_tree(root.left, p, q)
    right = lca_binary_tree(root.right, p, q)

    if left and right:
        return root  # p and q are in different subtrees
    return left if left else right
```

### Approach 1b: LCA for BST -- O(h) per query

```python
def lca_bst(root: TreeNode | None, p: TreeNode, q: TreeNode) -> TreeNode | None:
    """Find LCA in a BST. O(h) time using BST property."""
    while root:
        if p.val < root.val and q.val < root.val:
            root = root.left
        elif p.val > root.val and q.val > root.val:
            root = root.right
        else:
            return root  # Split point = LCA
    return None
```

### Approach 2: Binary Lifting -- O(n log n) preprocessing, O(log n) per query

Binary lifting precomputes `up[v][k]` = the 2^k-th ancestor of node `v`. To find LCA,
lift both nodes to the same depth, then lift both simultaneously until they meet.

```python
import math


class BinaryLifting:
    """LCA using binary lifting. O(n log n) preprocessing, O(log n) per query."""

    def __init__(self, n: int, adj: list[list[int]], root: int = 0):
        self.n = n
        self.LOG = max(1, int(math.log2(n)) + 1)
        self.depth = [0] * n
        self.up = [[0] * n for _ in range(self.LOG)]

        # BFS to compute depths and direct parents
        from collections import deque
        visited = [False] * n
        visited[root] = True
        queue = deque([root])
        self.up[0][root] = root

        while queue:
            v = queue.popleft()
            for u in adj[v]:
                if not visited[u]:
                    visited[u] = True
                    self.depth[u] = self.depth[v] + 1
                    self.up[0][u] = v  # Direct parent
                    queue.append(u)

        # Build sparse table of ancestors
        for k in range(1, self.LOG):
            for v in range(n):
                self.up[k][v] = self.up[k - 1][self.up[k - 1][v]]

    def lca(self, u: int, v: int) -> int:
        """Find LCA of nodes u and v. O(log n)."""
        # Step 1: Bring u and v to the same depth
        if self.depth[u] < self.depth[v]:
            u, v = v, u

        diff = self.depth[u] - self.depth[v]
        for k in range(self.LOG):
            if (diff >> k) & 1:
                u = self.up[k][u]

        if u == v:
            return u

        # Step 2: Lift both nodes simultaneously
        for k in range(self.LOG - 1, -1, -1):
            if self.up[k][u] != self.up[k][v]:
                u = self.up[k][u]
                v = self.up[k][v]

        return self.up[0][u]


# Usage
# Tree:
#        0
#       / \
#      1   2
#     / \   \
#    3   4   5
#   /
#  6

n = 7
adj = [[] for _ in range(n)]
edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (3, 6)]
for u, v in edges:
    adj[u].append(v)
    adj[v].append(u)

bl = BinaryLifting(n, adj, root=0)
print(bl.lca(3, 4))  # 1
print(bl.lca(6, 4))  # 1
print(bl.lca(6, 5))  # 0
print(bl.lca(3, 5))  # 0
```

### Approach 3: Euler Tour + RMQ -- O(n) preprocessing, O(1) per query

This approach reduces LCA to a Range Minimum Query (RMQ) problem:

1. Perform Euler tour, recording depths and first occurrences
2. LCA(u, v) = the node with minimum depth between first[u] and first[v] in the Euler tour
3. Use a Sparse Table for O(1) RMQ

**Complexity:** O(n) preprocessing (with linear RMQ), O(1) per query. In practice, Sparse
Table gives O(n log n) preprocessing and O(1) per query.

### LCA Complexity Summary

| Approach                 | Preprocessing | Per Query | Space      |
|--------------------------|---------------|-----------|------------|
| Naive (binary tree)      | O(0)          | O(n)      | O(h)       |
| BST property             | O(0)          | O(h)      | O(1)       |
| Binary Lifting           | O(n log n)    | O(log n)  | O(n log n) |
| Euler Tour + Sparse Table| O(n log n)    | O(1)      | O(n log n) |
| Euler Tour + linear RMQ  | O(n)          | O(1)      | O(n)       |

**Applications:** Finding distance between nodes (`dist(u,v) = depth[u] + depth[v] - 2*depth[lca]`),
tree path queries, tree DP with virtual trees.

---

## B-Tree / B+ Tree

B-Trees are self-balancing search trees designed for systems that read and write large blocks
of data (disks, SSDs, databases).

### B-Tree Properties (Order m)

```
1. Every node has at most m children
2. Every non-leaf non-root node has at least ceil(m/2) children
3. The root has at least 2 children (if not a leaf)
4. All leaves appear at the same level
5. A node with k children has k-1 keys
```

### B-Tree Structure (Order 3 = 2-3 Tree)

```
                    [17]
                   /    \
            [5, 13]      [21, 29]
           /   |   \    /   |    \
        [2,3] [7,11] [14] [19,20] [25,27] [31,35]

  Properties:
  - All leaves at same depth (level 2)
  - Each internal node has 2-3 children
  - Keys within each node are sorted
  - All keys in left subtree < parent key < all keys in right subtree
```

### B-Tree vs B+ Tree

```
                B-Tree                    B+ Tree
  ┌────────────────────────┐   ┌─────────────────────────────┐
  │  - Data in ALL nodes   │   │  - Data ONLY in leaves      │
  │  - No leaf linking     │   │  - Leaves linked (for scans)│
  │  - Less duplication    │   │  - Internal keys duplicated  │
  │  - Point query faster  │   │  - Range query much faster   │
  └────────────────────────┘   └─────────────────────────────┘
```

### B+ Tree Leaf Chain

```
Internal:       [10     |     20]
               /        |        \
Leaves:   [3,5,7] <-> [10,12,15] <-> [20,25,30]
              linked list for sequential scans
```

### Why B-Trees for Databases

1. **Disk I/O optimization:** Each node = one disk page (4KB-16KB). Minimizes disk reads.
2. **Shallow tree:** A B-Tree of order 1000 with 1 billion keys has height ~3. Only 3 disk
   reads to find any key.
3. **Range scans:** B+ Tree linked leaves enable efficient range queries (e.g., `WHERE age
   BETWEEN 20 AND 30`).

### Real-World Usage

| System           | Tree Type  | Node Size | Usage                        |
|------------------|------------|-----------|------------------------------|
| MySQL InnoDB     | B+ Tree    | 16 KB     | Primary and secondary indexes|
| PostgreSQL       | B+ Tree    | 8 KB      | Default index type           |
| SQLite           | B+ Tree    | 4 KB      | Tables and indexes           |
| NTFS             | B+ Tree    | 4 KB      | File system directory index  |
| ext4             | H-Tree*    | 4 KB      | Directory indexing           |
| HFS+             | B-Tree     | 4 KB      | Catalog and extents          |
| MongoDB WiredTiger| B+ Tree   | 4 KB      | Collection indexes           |

*H-Tree is a specialized hash + B-tree hybrid.

### B-Tree Operations (Conceptual)

**Search:** Like BST search, but at each node, binary search among multiple keys to find the
correct child pointer. O(log_m(n) * log(m)) = O(log n).

**Insert:**
1. Search for the correct leaf node
2. If leaf has space, insert the key in sorted order
3. If leaf is full, **split** it into two nodes and push the median key up to the parent
4. If parent overflows, recursively split upward (may increase tree height)

**Delete:**
1. Find and remove the key
2. If node underflows (fewer than ceil(m/2)-1 keys):
   a. Try to **borrow** from a sibling
   b. If borrowing fails, **merge** with a sibling and pull down parent key
3. Merging may cascade upward (may decrease tree height)

### B-Tree Complexity

| Operation | Time (disk I/O) | Time (comparisons) |
|-----------|-----------------|---------------------|
| Search    | O(log_m n)      | O(log n)            |
| Insert    | O(log_m n)      | O(m * log_m n)      |
| Delete    | O(log_m n)      | O(m * log_m n)      |

Where m = order of the tree, and disk I/O is the dominant cost in practice.

---

## Comparison Table

```
Structure        Build       Query       Update      Space     Best For
──────────────────────────────────────────────────────────────────────────
Segment Tree     O(n)        O(log n)    O(log n)    O(4n)     Range queries (sum/min/max)
Fenwick Tree     O(n)        O(log n)    O(log n)    O(n)      Prefix sums, inversions
Trie             O(sum(m))   O(m)        O(m)        O(sum(m)) String prefix search
B-Tree           O(n log n)  O(log n)    O(log n)    O(n)      Disk-based indexing
Binary Lifting   O(n log n)  O(log n)    N/A         O(n log n) LCA queries
```

---

## Common Interview / Contest Problems

| Problem                            | Structure        | Time        |
|------------------------------------|------------------|-------------|
| Range sum query + point update     | Fenwick/Segment  | O(log n)    |
| Range min/max query                | Segment Tree     | O(log n)    |
| Count inversions in array          | Fenwick Tree     | O(n log n)  |
| LCA of two nodes                   | Binary Lifting   | O(log n)    |
| Autocomplete system                | Trie             | O(m + k)    |
| Database index lookup              | B+ Tree          | O(log n)    |
| Range update + range query         | Lazy Segment Tree| O(log n)    |
| Kth smallest in range              | Persistent Seg   | O(log n)    |
| 2D range sum                       | 2D Fenwick       | O(log^2 n)  |

---

## Sources

- Cormen, Leiserson, Rivest, Stein. *Introduction to Algorithms* (CLRS), 4th Ed., Ch. 14 "Augmenting Data Structures", Ch. 18 "B-Trees"
- Fenwick, P.M. "A New Data Structure for Cumulative Frequency Tables" (1994), Software: Practice and Experience
- Bayer, R., McCreight, E. "Organization and Maintenance of Large Ordered Indexes" (1970), Acta Informatica
- Bender, M.A., Farach-Colton, M. "The LCA Problem Revisited" (2000), LATIN
- cp-algorithms.com: Segment Tree, Fenwick Tree, Lowest Common Ancestor
- Wikipedia: "B-tree", "Segment tree", "Fenwick tree", "Lowest common ancestor"
- Graefe, G. "Modern B-Tree Techniques" (2011), Foundations and Trends in Databases
