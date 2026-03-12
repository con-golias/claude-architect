# Disjoint Sets (Union-Find)

> **Domain:** Fundamentals > Data Structures > Advanced
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A disjoint set (Union-Find) is a data structure that maintains a collection of non-overlapping sets and supports two operations:
- **Find** — determine which set an element belongs to.
- **Union** — merge two sets into one.

With path compression and union by rank, both operations run in nearly O(1) time — specifically O(α(n)) where α is the inverse Ackermann function, which is effectively constant for all practical inputs.

## Why It Matters

- **Nearly O(1) connectivity queries** — "are these two elements connected?"
- **Kruskal's MST** — union-find determines whether adding an edge creates a cycle.
- **Connected components** — efficiently track and merge components in dynamic graphs.
- **Image processing** — connected component labeling, percolation.
- **Network connectivity** — real-time queries about network partitions.

## How It Works

### Concept

```
Initially: each element is its own set
{0} {1} {2} {3} {4} {5} {6} {7}

Union(0, 1):  {0, 1} {2} {3} {4} {5} {6} {7}
Union(2, 3):  {0, 1} {2, 3} {4} {5} {6} {7}
Union(0, 2):  {0, 1, 2, 3} {4} {5} {6} {7}
Union(5, 6):  {0, 1, 2, 3} {4} {5, 6} {7}

Find(1) = Find(3)? YES (same set)
Find(0) = Find(5)? NO (different sets)
```

### Tree Representation

Each set is represented as a tree. The root is the "representative" of the set.

```
Before optimization:       After path compression:
    0                          0
   / \                       /|\ \
  1   2                     1 2 3  ...
      |
      3                    (all point directly to root)
```

### Implementation

```python
class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))  # each element is its own root
        self.rank = [0] * n           # tree height upper bound
        self.count = n                # number of disjoint sets

    def find(self, x: int) -> int:
        """O(α(n)) ≈ O(1) — find root with path compression."""
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        """O(α(n)) ≈ O(1) — merge sets. Returns False if already same set."""
        root_x = self.find(x)
        root_y = self.find(y)

        if root_x == root_y:
            return False  # already in the same set

        # Union by rank — attach shorter tree under taller tree
        if self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        elif self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1

        self.count -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        """O(α(n)) ≈ O(1) — check if x and y are in the same set."""
        return self.find(x) == self.find(y)
```

```java
class UnionFind {
    private int[] parent;
    private int[] rank;
    private int count;

    public UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        count = n;
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    public int find(int x) {
        if (parent[x] != x)
            parent[x] = find(parent[x]);  // path compression
        return parent[x];
    }

    public boolean union(int x, int y) {
        int rx = find(x), ry = find(y);
        if (rx == ry) return false;
        if (rank[rx] < rank[ry]) parent[rx] = ry;
        else if (rank[rx] > rank[ry]) parent[ry] = rx;
        else { parent[ry] = rx; rank[rx]++; }
        count--;
        return true;
    }

    public boolean connected(int x, int y) {
        return find(x) == find(y);
    }
}
```

### Two Key Optimizations

**1. Path Compression (Find):**
Make every node on the find path point directly to the root.
```
Before: 0 → 1 → 2 → 3 (root)
After:  0 → 3, 1 → 3, 2 → 3 (all point to root)
```

**2. Union by Rank (Union):**
Always attach the shorter tree under the root of the taller tree.
```
Rank 2 tree + Rank 1 tree:
Attach rank-1 under rank-2 (not the other way around)
```

Together: O(α(n)) per operation, where α(n) ≤ 4 for any n up to 2^65536.

### Operations and Time Complexity

| Operation | Without optimization | With both optimizations |
|-----------|---------------------|----------------------|
| Find | O(n) | O(α(n)) ≈ O(1) |
| Union | O(n) | O(α(n)) ≈ O(1) |
| Connected | O(n) | O(α(n)) ≈ O(1) |
| Space | O(n) | O(n) |

### Kruskal's MST with Union-Find

```python
def kruskal(n: int, edges: list[tuple[int, int, int]]) -> list[tuple]:
    edges.sort(key=lambda e: e[2])  # sort by weight
    uf = UnionFind(n)
    mst = []

    for u, v, weight in edges:
        if uf.union(u, v):  # only add if doesn't create cycle
            mst.append((u, v, weight))
            if len(mst) == n - 1:
                break  # MST complete

    return mst
```

## Best Practices

1. **Always use both optimizations** — path compression AND union by rank together.
2. **Use for dynamic connectivity** — "are X and Y connected?" with evolving connections.
3. **Track set count** — decrement on successful union to know how many components remain.
4. **Prefer over DFS/BFS** when you only need connectivity, not actual paths.

## Anti-patterns / Common Mistakes

- **Forgetting path compression** — without it, chains can grow to O(n).
- **Union by rank without path compression** — O(log n) instead of O(α(n)).
- **Using for shortest paths** — union-find tracks connectivity, not distances.
- **Not tracking component count** — useful for "number of connected components" problems.

## Real-world Examples

- **Kruskal's MST** — cycle detection during edge addition.
- **Network connectivity** — tracking which servers/routers can reach each other.
- **Image processing** — connected component labeling in binary images.
- **Percolation simulation** — modeling fluid flow through porous materials.
- **Social network "friend groups"** — finding connected friend clusters.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Tarjan, R.E. (1975). "Efficiency of a Good but Not Linear Set Union Algorithm."
- [Wikipedia — Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure)
