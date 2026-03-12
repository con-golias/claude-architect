# Minimum Spanning Tree

> **Domain:** Fundamentals > Algorithms > Graph > Minimum Spanning Tree
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-07

---

## What It Is

A **minimum spanning tree (MST)** of a connected, undirected, weighted graph is a
subset of edges that:

1. **Connects all vertices** (spanning)
2. **Forms no cycles** (tree)
3. **Has minimum total edge weight** (minimum)

An MST has exactly **V - 1 edges** for a graph with V vertices. If the graph is not
connected, we get a **minimum spanning forest** (one MST per connected component).

```
Original Graph:                  Minimum Spanning Tree:

    A --4-- B                       A       B
    |\ \    |                       |       |
    | 2  8  3                       2       3
    |    \  |                       |       |
    C --7-- D --9-- E               C   D   D --9-- E
    |           |                        |
    6           5                        5
    |           |                        |
    F ----1---- G                   F ----1---- G

  Total weight of MST: 2 + 3 + 9 + 5 + 1 = 20
  (Edges: A-C, B-D, D-E, D-G, G-F)
```

---

## Properties of MSTs

### 1. Cut Property

For any cut (partition of vertices into two sets), the **minimum-weight edge crossing
the cut** must be in the MST.

```
Cut dividing {A, C, F} from {B, D, E, G}:

    {A, C, F}  |  {B, D, E, G}
               |
    A ---4---- | --- B
    |          |     |
    C ---7---- | --- D
    |          |     |
    F ---1---- | --- G

Edges crossing cut: A-B(4), C-D(7), F-G(1)
Minimum crossing edge: F-G(1) -- this MUST be in the MST.
```

### 2. Cycle Property

The **maximum-weight edge in any cycle** is NOT in the MST (unless removing it
disconnects the graph, which doesn't happen in a cycle).

### 3. Uniqueness

- If all edge weights are **distinct**, the MST is **unique**.
- If some edge weights are equal, the graph may have **multiple valid MSTs** with
  the same total weight.

### 4. Number of Edges

An MST of a connected graph with V vertices always has exactly **V - 1** edges.
This is a fundamental property of trees.

---

## Kruskal's Algorithm

Kruskal's algorithm is an **edge-centric** greedy approach:

1. Sort all edges by weight (ascending).
2. For each edge (in sorted order), add it to the MST if it doesn't create a cycle.
3. Use **Union-Find** to efficiently check for cycles.
4. Stop when V-1 edges have been added.

### Step-by-Step ASCII Trace

```
Graph edges sorted by weight:

  Edge     Weight
  F-G        1
  A-C        2
  B-D        3
  A-B        4
  D-G        5
  A-F        6
  C-D        7
  A-D        8
  D-E        9

Process edges:
  F-G (1): Add. Components: {A},{B},{C},{D},{E},{F,G}      MST edges: 1
  A-C (2): Add. Components: {A,C},{B},{D},{E},{F,G}        MST edges: 2
  B-D (3): Add. Components: {A,C},{B,D},{E},{F,G}          MST edges: 3
  A-B (4): Add. Components: {A,B,C,D},{E},{F,G}            MST edges: 4
  D-G (5): Add. Components: {A,B,C,D,F,G},{E}             MST edges: 5
  A-F (6): SKIP. A and F already connected.
  C-D (7): SKIP. C and D already connected.
  A-D (8): SKIP. A and D already connected.
  D-E (9): Add. Components: {A,B,C,D,E,F,G}               MST edges: 6 = V-1. Done!

MST total weight: 1 + 2 + 3 + 4 + 5 + 9 = 24
```

### Python Implementation

```python
class UnionFind:
    """
    Disjoint Set Union (Union-Find) with path compression
    and union by rank. Amortized O(alpha(n)) per operation.
    """

    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.components = n

    def find(self, x: int) -> int:
        """Find root with path compression."""
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        """
        Union by rank. Returns True if x and y were in different sets
        (i.e., edge does NOT create a cycle).
        """
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False  # Already in same set -- would create cycle

        # Attach smaller tree under larger tree
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

        self.components -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)


def kruskal(
    num_vertices: int,
    edges: list[tuple[int, int, float]]
) -> tuple[list[tuple[int, int, float]], float]:
    """
    Kruskal's MST algorithm.

    Args:
        num_vertices: number of vertices (0-indexed)
        edges: list of (u, v, weight) tuples

    Returns:
        (mst_edges, total_weight)
    """
    # Sort edges by weight
    sorted_edges = sorted(edges, key=lambda e: e[2])

    uf = UnionFind(num_vertices)
    mst_edges: list[tuple[int, int, float]] = []
    total_weight = 0.0

    for u, v, w in sorted_edges:
        if uf.union(u, v):
            mst_edges.append((u, v, w))
            total_weight += w

            # MST complete when we have V-1 edges
            if len(mst_edges) == num_vertices - 1:
                break

    if len(mst_edges) < num_vertices - 1:
        raise ValueError("Graph is not connected -- no spanning tree exists")

    return mst_edges, total_weight


# --- Example ---
edges = [
    (0, 1, 4),  # A-B
    (0, 2, 2),  # A-C
    (0, 3, 8),  # A-D
    (0, 5, 6),  # A-F
    (1, 3, 3),  # B-D
    (2, 3, 7),  # C-D
    (3, 4, 9),  # D-E
    (3, 6, 5),  # D-G
    (5, 6, 1),  # F-G
]

mst, weight = kruskal(7, edges)
print(f"MST edges: {mst}")
print(f"Total weight: {weight}")
# MST edges: [(5, 6, 1), (0, 2, 2), (1, 3, 3), (0, 1, 4), (3, 6, 5), (3, 4, 9)]
# Total weight: 24
```

### TypeScript Implementation

```typescript
class UnionFind {
  private parent: number[];
  private rank: number[];
  components: number;

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
    this.components = n;
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): boolean {
    let rx = this.find(x);
    let ry = this.find(y);
    if (rx === ry) return false; // Same set -- would create cycle

    // Union by rank
    if (this.rank[rx] < this.rank[ry]) [rx, ry] = [ry, rx];
    this.parent[ry] = rx;
    if (this.rank[rx] === this.rank[ry]) this.rank[rx]++;

    this.components--;
    return true;
  }

  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }
}

interface WEdge {
  u: number;
  v: number;
  weight: number;
}

function kruskal(numVertices: number, edges: WEdge[]): { mst: WEdge[]; totalWeight: number } {
  const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
  const uf = new UnionFind(numVertices);
  const mst: WEdge[] = [];
  let totalWeight = 0;

  for (const edge of sortedEdges) {
    if (uf.union(edge.u, edge.v)) {
      mst.push(edge);
      totalWeight += edge.weight;

      if (mst.length === numVertices - 1) break;
    }
  }

  if (mst.length < numVertices - 1) {
    throw new Error("Graph is not connected");
  }

  return { mst, totalWeight };
}

// Usage
const edges: WEdge[] = [
  { u: 0, v: 1, weight: 4 },
  { u: 0, v: 2, weight: 2 },
  { u: 1, v: 3, weight: 3 },
  { u: 2, v: 3, weight: 7 },
  { u: 3, v: 4, weight: 9 },
  { u: 3, v: 6, weight: 5 },
  { u: 5, v: 6, weight: 1 },
  { u: 0, v: 5, weight: 6 },
  { u: 0, v: 3, weight: 8 },
];

const result = kruskal(7, edges);
console.log("MST:", result.mst);
console.log("Total weight:", result.totalWeight);
```

### Complexity

- **Time:** O(E log E) -- dominated by sorting edges. Since E <= V^2, log E = O(log V),
  so equivalently O(E log V).
- **Space:** O(V + E) -- Union-Find uses O(V), edge list uses O(E).
- **Best for:** sparse graphs where E is much smaller than V^2.

---

## Prim's Algorithm

Prim's algorithm is a **vertex-centric** greedy approach:

1. Start from any vertex. Mark it as part of the MST.
2. Among all edges connecting MST vertices to non-MST vertices, pick the one with
   minimum weight.
3. Add the chosen edge and the new vertex to the MST.
4. Repeat until all vertices are in the MST.

### Step-by-Step ASCII Trace

```
Graph:
    A --4-- B
    |\ \    |
    | 2  8  3
    |    \  |
    C --7-- D --9-- E
    |           |
    6           5
    |           |
    F ----1---- G

Prim's starting from vertex A:

Step  MST vertices    Candidate edges (to non-MST)      Choose
────  ──────────────  ──────────────────────────────     ──────
  1   {A}             A-B(4), A-C(2), A-D(8), A-F(6)   A-C(2)
  2   {A, C}          A-B(4), C-D(7), A-D(8), A-F(6)   A-B(4)
  3   {A, B, C}       B-D(3), C-D(7), A-D(8), A-F(6)   B-D(3)
  4   {A, B, C, D}    D-E(9), D-G(5), A-F(6)            D-G(5)
  5   {A,B,C,D,G}     D-E(9), G-F(1)                    G-F(1)
  6   {A,B,C,D,F,G}   D-E(9)                            D-E(9)
  7   {A,B,C,D,E,F,G} Done!

MST edges: A-C(2), A-B(4), B-D(3), D-G(5), G-F(1), D-E(9)
Total weight: 2 + 4 + 3 + 5 + 1 + 9 = 24
```

### Python Implementation

```python
import heapq

def prim(
    graph: dict[int, list[tuple[int, float]]],
    num_vertices: int,
    start: int = 0
) -> tuple[list[tuple[int, int, float]], float]:
    """
    Prim's MST algorithm using a min-heap (priority queue).

    Args:
        graph: adjacency list {vertex: [(neighbor, weight), ...]}
        num_vertices: total number of vertices
        start: starting vertex (default 0)

    Returns:
        (mst_edges, total_weight)
    """
    in_mst = [False] * num_vertices
    mst_edges: list[tuple[int, int, float]] = []
    total_weight = 0.0

    # Priority queue: (weight, from_vertex, to_vertex)
    # Start by adding all edges from the start vertex
    pq: list[tuple[float, int, int]] = []
    in_mst[start] = True

    for neighbor, weight in graph.get(start, []):
        heapq.heappush(pq, (weight, start, neighbor))

    while pq and len(mst_edges) < num_vertices - 1:
        weight, u, v = heapq.heappop(pq)

        if in_mst[v]:
            continue  # Skip -- would create cycle

        # Add vertex v to MST
        in_mst[v] = True
        mst_edges.append((u, v, weight))
        total_weight += weight

        # Add all edges from v to non-MST vertices
        for neighbor, w in graph.get(v, []):
            if not in_mst[neighbor]:
                heapq.heappush(pq, (w, v, neighbor))

    if len(mst_edges) < num_vertices - 1:
        raise ValueError("Graph is not connected")

    return mst_edges, total_weight


# --- Example ---
graph = {
    0: [(1, 4), (2, 2), (3, 8), (5, 6)],   # A
    1: [(0, 4), (3, 3)],                     # B
    2: [(0, 2), (3, 7)],                     # C
    3: [(0, 8), (1, 3), (2, 7), (4, 9), (6, 5)],  # D
    4: [(3, 9)],                              # E
    5: [(0, 6), (6, 1)],                      # F
    6: [(3, 5), (5, 1)],                      # G
}

mst, weight = prim(graph, 7)
print(f"MST edges: {mst}")
print(f"Total weight: {weight}")
```

### Java Implementation

```java
import java.util.*;

public class Prim {

    static class Edge implements Comparable<Edge> {
        int from, to;
        long weight;

        Edge(int from, int to, long weight) {
            this.from = from;
            this.to = to;
            this.weight = weight;
        }

        @Override
        public int compareTo(Edge other) {
            return Long.compare(this.weight, other.weight);
        }
    }

    public static List<Edge> prim(
            Map<Integer, List<Edge>> graph,
            int numVertices,
            int start) {

        boolean[] inMST = new boolean[numVertices];
        List<Edge> mstEdges = new ArrayList<>();
        PriorityQueue<Edge> pq = new PriorityQueue<>();
        long totalWeight = 0;

        inMST[start] = true;
        for (Edge e : graph.getOrDefault(start, List.of())) {
            pq.offer(e);
        }

        while (!pq.isEmpty() && mstEdges.size() < numVertices - 1) {
            Edge e = pq.poll();

            if (inMST[e.to]) continue;

            inMST[e.to] = true;
            mstEdges.add(e);
            totalWeight += e.weight;

            for (Edge next : graph.getOrDefault(e.to, List.of())) {
                if (!inMST[next.to]) {
                    pq.offer(next);
                }
            }
        }

        System.out.println("Total MST weight: " + totalWeight);
        return mstEdges;
    }

    public static void main(String[] args) {
        Map<Integer, List<Edge>> graph = new HashMap<>();

        // Helper to add undirected edge
        var addEdge = new Object() {
            void add(int u, int v, long w) {
                graph.computeIfAbsent(u, k -> new ArrayList<>()).add(new Edge(u, v, w));
                graph.computeIfAbsent(v, k -> new ArrayList<>()).add(new Edge(v, u, w));
            }
        };

        addEdge.add(0, 1, 4);  // A-B
        addEdge.add(0, 2, 2);  // A-C
        addEdge.add(1, 3, 3);  // B-D
        addEdge.add(2, 3, 7);  // C-D
        addEdge.add(3, 4, 9);  // D-E
        addEdge.add(3, 6, 5);  // D-G
        addEdge.add(5, 6, 1);  // F-G
        addEdge.add(0, 5, 6);  // A-F
        addEdge.add(0, 3, 8);  // A-D

        List<Edge> mst = prim(graph, 7, 0);
        for (Edge e : mst) {
            System.out.printf("(%d, %d) weight=%d%n", e.from, e.to, e.weight);
        }
    }
}
```

### Complexity

| Implementation | Time | Space |
|---|---|---|
| Binary heap | O((V + E) log V) | O(V + E) |
| Fibonacci heap | O(E + V log V) | O(V + E) |
| Adjacency matrix (no heap) | O(V^2) | O(V) |

- **Best for:** dense graphs, especially with adjacency matrix (O(V^2) beats
  sorting O(E log E) when E approaches V^2).

---

## Kruskal vs Prim Comparison

```
Feature              Kruskal's                    Prim's
─────────────────────────────────────────────────────────────────────
Approach             Edge-centric (sort edges)    Vertex-centric (grow tree)
Data Structure       Union-Find                   Priority Queue (min-heap)
Time Complexity      O(E log E)                   O((V+E) log V)
Best For             Sparse graphs (E ~ V)        Dense graphs (E ~ V^2)
Strategy             Global: sort all edges        Local: grow from one vertex
Starting Point       No starting vertex needed    Needs a starting vertex
Parallelizable       Less naturally                Less naturally
Implementation       Simpler (sort + union-find)  Slightly more complex (heap)
Edge Sorting         Required (upfront cost)      Not required
Disconnected Graph   Naturally produces forest    Needs to restart per component
```

**Rule of thumb:**
- Sparse graph (E << V^2): Kruskal's is typically faster.
- Dense graph (E close to V^2): Prim's with adjacency matrix O(V^2) beats
  Kruskal's O(E log E) = O(V^2 log V).

---

## Union-Find (Disjoint Set Union) — Deep Dive

Union-Find is essential for Kruskal's algorithm and many other applications. It
maintains a collection of disjoint sets and supports two operations:

- **find(x):** Return the representative (root) of the set containing x.
- **union(x, y):** Merge the sets containing x and y.

### Optimizations

1. **Path compression** (in `find`): Make every node point directly to the root.
   Flattens the tree structure over time.

2. **Union by rank** (in `union`): Attach the shorter tree under the taller tree.
   Prevents the tree from becoming a linked list.

Together, these give **amortized O(alpha(n))** per operation, where alpha is the
**inverse Ackermann function** -- a function that grows so slowly it is effectively
constant (alpha(n) <= 4 for any practical n).

### How Path Compression Works

```
Before find(5):          After find(5):

    1                       1
   / \                    / | \ \
  2   3                  2  3  4  5
  |                          |
  4                          6
  |
  5
  |
  6

All nodes on the path from 5 to root (1) now point directly to 1.
Next time we call find(5), it returns in O(1).
```

### How Union by Rank Works

```
Union(A-set, B-set):

  If rank(A) > rank(B):     If rank(A) == rank(B):
    Attach B under A          Attach B under A, increment rank(A)

     A                          A (rank+1)
    / \                        / \
   ... B                     ... B
      / \                       / \
     ...                       ...
```

### Python Implementation

```python
class UnionFind:
    """
    Disjoint Set Union with path compression and union by rank.

    Supports:
      - find(x): O(alpha(n)) amortized
      - union(x, y): O(alpha(n)) amortized
      - connected(x, y): O(alpha(n)) amortized

    alpha(n) is the inverse Ackermann function, effectively O(1).
    """

    def __init__(self, n: int):
        self.parent = list(range(n))  # Each element is its own parent
        self.rank = [0] * n           # Rank (upper bound on height)
        self.size = [1] * n           # Size of each set
        self.num_components = n       # Number of disjoint sets

    def find(self, x: int) -> int:
        """Find root of x with path compression."""
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        """
        Merge sets containing x and y.
        Returns True if they were in different sets (merge happened).
        Returns False if they were already in the same set.
        """
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False

        # Union by rank: attach smaller tree under larger tree
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx

        self.parent[ry] = rx
        self.size[rx] += self.size[ry]

        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

        self.num_components -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        """Check if x and y are in the same set."""
        return self.find(x) == self.find(y)

    def set_size(self, x: int) -> int:
        """Return size of the set containing x."""
        return self.size[self.find(x)]


# --- Example ---
uf = UnionFind(7)
uf.union(0, 1)  # {0,1}, {2}, {3}, {4}, {5}, {6}
uf.union(2, 3)  # {0,1}, {2,3}, {4}, {5}, {6}
uf.union(0, 3)  # {0,1,2,3}, {4}, {5}, {6}

print(uf.connected(1, 2))    # True (both in {0,1,2,3})
print(uf.connected(1, 4))    # False
print(uf.num_components)      # 4
print(uf.set_size(0))         # 4
```

### TypeScript Implementation

```typescript
class DisjointSetUnion {
  private parent: number[];
  private rank: number[];
  private _size: number[];
  numComponents: number;

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
    this._size = new Array(n).fill(1);
    this.numComponents = n;
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): boolean {
    let rx = this.find(x);
    let ry = this.find(y);
    if (rx === ry) return false;

    // Union by rank
    if (this.rank[rx] < this.rank[ry]) [rx, ry] = [ry, rx];
    this.parent[ry] = rx;
    this._size[rx] += this._size[ry];
    if (this.rank[rx] === this.rank[ry]) this.rank[rx]++;

    this.numComponents--;
    return true;
  }

  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }

  setSize(x: number): number {
    return this._size[this.find(x)];
  }
}

// Example
const dsu = new DisjointSetUnion(7);
dsu.union(0, 1);
dsu.union(2, 3);
dsu.union(0, 3);

console.log(dsu.connected(1, 2));    // true
console.log(dsu.connected(1, 4));    // false
console.log(dsu.numComponents);       // 4
console.log(dsu.setSize(0));          // 4
```

### Union-Find Complexity Summary

```
Operation        Naive       Path Compression    PC + Union by Rank
──────────────────────────────────────────────────────────────────────
find(x)          O(n)        O(log n) amortized  O(alpha(n)) amortized
union(x,y)       O(n)        O(log n) amortized  O(alpha(n)) amortized
connected(x,y)   O(n)        O(log n) amortized  O(alpha(n)) amortized

alpha(n) = inverse Ackermann function
alpha(n) <= 4 for n <= 10^80 (larger than atoms in universe)
Effectively O(1) for all practical purposes.
```

---

## Boruvka's Algorithm

Boruvka's algorithm (1926) is the **oldest MST algorithm**, predating both Kruskal's
and Prim's. It is notable for being naturally **parallelizable**.

### How It Works

1. Start with each vertex as its own component.
2. For each component, find the **cheapest edge** leaving that component.
3. Add all such cheapest edges simultaneously.
4. Repeat until there is only one component (the MST).

### Properties

- **Time:** O(E log V) -- each phase at least halves the number of components,
  so there are at most O(log V) phases. Each phase processes all E edges.
- **Space:** O(V + E)
- **Parallelizable:** All components can find their cheapest edge independently,
  making it well-suited for distributed and parallel computing.

### Python Implementation (Simplified)

```python
def boruvka(num_vertices: int, edges: list[tuple[int, int, float]]) -> float:
    """
    Boruvka's MST algorithm.

    Returns the total weight of the MST.
    """
    uf = UnionFind(num_vertices)
    total_weight = 0.0
    num_edges_added = 0

    while uf.num_components > 1:
        # For each component, find the cheapest outgoing edge
        cheapest = [None] * num_vertices  # cheapest[comp] = (weight, u, v)

        for u, v, w in edges:
            comp_u = uf.find(u)
            comp_v = uf.find(v)

            if comp_u == comp_v:
                continue  # Same component, skip

            # Update cheapest edge for comp_u
            if cheapest[comp_u] is None or w < cheapest[comp_u][0]:
                cheapest[comp_u] = (w, u, v)

            # Update cheapest edge for comp_v
            if cheapest[comp_v] is None or w < cheapest[comp_v][0]:
                cheapest[comp_v] = (w, u, v)

        # Add all cheapest edges
        progress = False
        for comp in range(num_vertices):
            if cheapest[comp] is not None:
                w, u, v = cheapest[comp]
                if uf.union(u, v):
                    total_weight += w
                    num_edges_added += 1
                    progress = True

        if not progress:
            break  # Graph might not be connected

    if num_edges_added < num_vertices - 1:
        raise ValueError("Graph is not connected")

    return total_weight


# Example
edges = [
    (0, 1, 4), (0, 2, 2), (1, 3, 3), (2, 3, 7),
    (3, 4, 9), (3, 6, 5), (5, 6, 1), (0, 5, 6), (0, 3, 8),
]

print(f"MST weight: {boruvka(7, edges)}")  # 24
```

### Historical Note

Otakar Boruvka published this algorithm in 1926 to solve the problem of building an
efficient electrical network in Moravia (now part of the Czech Republic). It is the
earliest known algorithm for finding a minimum spanning tree, preceding Kruskal's (1956)
by 30 years and Prim's (1957) by 31 years.

---

## Applications of Minimum Spanning Trees

### 1. Network Design

MSTs model the problem of connecting all locations at minimum cost:

```
City network -- minimize cable length:

  NYC --350-- BOS          MST solution:
   |  \        |
  200  250   150           NYC --200-- DC
   |     \    |              |
  DC --300-- PHL           BOS --150-- PHL
                             |
                           NYC --250-- PHL (skip -- creates cycle)
                           DC  --300-- PHL (skip -- creates cycle)

  Minimum cable: 200 + 150 + 250 = 600 miles
  (vs connecting all: 200+350+250+150+300 = 1250)
```

- Building **road networks**, **telecommunications cables**, **pipelines**
- **Power grid** design
- **Internet backbone** routing

### 2. Cluster Analysis

Remove the k-1 heaviest edges from the MST to partition data into k clusters.
The resulting connected components are clusters.

```
MST:  A--1--B--2--C--8--D--1--E--3--F

Remove heaviest edge (C--D, weight 8) to get 2 clusters:
  Cluster 1: {A, B, C}
  Cluster 2: {D, E, F}

Remove next heaviest (E--F, weight 3) to get 3 clusters:
  Cluster 1: {A, B, C}
  Cluster 2: {D, E}
  Cluster 3: {F}
```

### 3. Image Segmentation

Pixels are vertices, edge weights are color differences. MST-based segmentation
groups similar adjacent pixels into regions.

### 4. TSP Approximation

For the Travelling Salesman Problem (NP-hard), an MST provides a 2-approximation:
1. Build MST of the complete graph.
2. Double all MST edges (Eulerian circuit exists).
3. Take shortcuts (skip revisited vertices).

The resulting tour has cost at most 2x the optimal TSP tour.

### 5. Other Applications

- **Maze generation** -- random MST of a grid creates a perfect maze
- **Handwriting recognition** -- MST features of stroke graphs
- **Phylogenetic trees** -- evolutionary relationships between species
- **Circuit design** -- connecting components on PCBs with minimum wire length

---

## MST Variants and Extensions

### Maximum Spanning Tree

Same as MST but maximize total weight. Simply negate all edge weights and run any
MST algorithm, or sort edges in descending order for Kruskal's.

### Minimum Bottleneck Spanning Tree

Minimize the maximum edge weight in the tree (not the sum). Every MST is also a
minimum bottleneck spanning tree (but not vice versa).

### Steiner Tree

Connect a subset of vertices (terminals) with minimum total weight, allowing use of
non-terminal vertices. This is NP-hard, unlike MST.

### Dynamic MST

Maintain MST as edges are inserted or deleted. Various algorithms achieve
O(sqrt(E)) per update.

---

## Complexity Summary

```
Algorithm           Time               Space       Best For
──────────────────────────────────────────────────────────────────
Kruskal's           O(E log E)          O(V + E)    Sparse graphs
Prim's (bin heap)   O((V+E) log V)      O(V + E)    Dense graphs
Prim's (fib heap)   O(E + V log V)      O(V + E)    Dense, many edges
Prim's (matrix)     O(V^2)              O(V)        Very dense graphs
Boruvka's           O(E log V)          O(V + E)    Parallel computing
```

**For most practical use:**
- Sparse: Kruskal's with Union-Find
- Dense: Prim's with binary heap or adjacency matrix
- Parallel: Boruvka's

---

## Sources

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022).
  *Introduction to Algorithms* (4th ed.), Chapter 23: Minimum Spanning Trees.
  MIT Press.
- Kruskal, J. B. (1956). "On the shortest spanning subtree of a graph and the
  travelling salesman problem." *Proceedings of the American Mathematical Society*,
  7(1), 48-50.
- Prim, R. C. (1957). "Shortest connection networks and some generalizations."
  *Bell System Technical Journal*, 36(6), 1389-1401.
- Boruvka, O. (1926). "O jistem problemu minimalnim" (About a certain minimal
  problem). *Prace Moravske Prirodovedecke Spolecnosti*, 3, 37-58.
- Tarjan, R. E. (1975). "Efficiency of a good but not linear set union algorithm."
  *Journal of the ACM*, 22(2), 215-225.
- Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.), Chapter 4: Minimum
  Spanning Trees. Addison-Wesley.
- Wikipedia. "Minimum spanning tree," "Kruskal's algorithm," "Prim's algorithm,"
  "Boruvka's algorithm," "Disjoint-set data structure."
  https://en.wikipedia.org/wiki/Minimum_spanning_tree
