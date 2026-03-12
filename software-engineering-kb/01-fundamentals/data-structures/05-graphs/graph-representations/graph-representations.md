# Graph Representations

> **Domain:** Fundamentals > Data Structures > Graphs
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A graph can be stored in memory using different data structures, each with different space and time tradeoffs. The three main representations are **adjacency list**, **adjacency matrix**, and **edge list**. The choice depends on the graph's density and the operations you need to perform.

## Why It Matters

- **Directly affects performance** — wrong representation can make algorithms orders of magnitude slower.
- **Space complexity** varies from O(V + E) to O(V^2).
- **Operation costs differ** — checking edge existence, iterating neighbors, adding/removing edges.

## How It Works

### Adjacency List

Each vertex stores a list of its neighbors. Best for **sparse graphs** (most real-world graphs).

```
Graph:
A — B
|   |
C — D — E

Adjacency List:
A: [B, C]
B: [A, D]
C: [A, D]
D: [B, C, E]
E: [D]
```

```python
# Python — dict of lists
graph = {
    'A': ['B', 'C'],
    'B': ['A', 'D'],
    'C': ['A', 'D'],
    'D': ['B', 'C', 'E'],
    'E': ['D'],
}

# Weighted graph — dict of lists of tuples
weighted_graph = {
    'A': [('B', 4), ('C', 2)],
    'B': [('A', 4), ('D', 5)],
    'C': [('A', 2), ('D', 1)],
    'D': [('B', 5), ('C', 1), ('E', 3)],
    'E': [('D', 3)],
}
```

```typescript
// TypeScript — Map of arrays
const graph = new Map<string, string[]>();
graph.set('A', ['B', 'C']);
graph.set('B', ['A', 'D']);

// Weighted
const weighted = new Map<string, [string, number][]>();
weighted.set('A', [['B', 4], ['C', 2]]);
```

```java
// Java — Map of Lists
Map<String, List<String>> graph = new HashMap<>();
graph.computeIfAbsent("A", k -> new ArrayList<>()).add("B");
graph.computeIfAbsent("A", k -> new ArrayList<>()).add("C");

// Or using adjacency list with array indices
List<List<Integer>> adj = new ArrayList<>();
for (int i = 0; i < numVertices; i++) {
    adj.add(new ArrayList<>());
}
adj.get(0).add(1);  // edge 0 → 1
```

### Adjacency Matrix

A 2D array where `matrix[i][j] = 1` if edge (i, j) exists. Best for **dense graphs** or when O(1) edge-existence check is needed.

```
     A  B  C  D  E
A  [ 0  1  1  0  0 ]
B  [ 1  0  0  1  0 ]
C  [ 1  0  0  1  0 ]
D  [ 0  1  1  0  1 ]
E  [ 0  0  0  1  0 ]

Weighted version: store weights instead of 1/0
Use ∞ (infinity) for non-edges
```

```python
import numpy as np

# Unweighted
matrix = np.zeros((5, 5), dtype=int)
matrix[0][1] = 1  # A-B edge
matrix[1][0] = 1  # B-A edge (undirected)

# Weighted
INF = float('inf')
weights = [
    [0,   4,   2,   INF, INF],
    [4,   0,   INF, 5,   INF],
    [2,   INF, 0,   1,   INF],
    [INF, 5,   1,   0,   3  ],
    [INF, INF, INF, 3,   0  ],
]
```

### Edge List

A simple list of all edges. Best for algorithms that process edges (Kruskal's MST, Bellman-Ford).

```python
# Unweighted
edges = [('A', 'B'), ('A', 'C'), ('B', 'D'), ('C', 'D'), ('D', 'E')]

# Weighted
weighted_edges = [
    ('A', 'B', 4),
    ('A', 'C', 2),
    ('B', 'D', 5),
    ('C', 'D', 1),
    ('D', 'E', 3),
]
```

### Comparison

| Operation | Adjacency List | Adjacency Matrix | Edge List |
|-----------|---------------|-----------------|-----------|
| Space | O(V + E) | O(V^2) | O(E) |
| Check edge (u,v) | O(degree(u)) | O(1) | O(E) |
| All neighbors of u | O(degree(u)) | O(V) | O(E) |
| Add edge | O(1) | O(1) | O(1) |
| Remove edge | O(degree(u)) | O(1) | O(E) |
| Add vertex | O(1) | O(V^2) rebuild | O(1) |
| Best for | Sparse graphs | Dense graphs | Edge-centric algorithms |

### When to Use What

```
Sparse graph (|E| << |V|²):  → Adjacency List
  Examples: social networks, web graphs, road networks

Dense graph (|E| ≈ |V|²):   → Adjacency Matrix
  Examples: complete graphs, small graphs, Floyd-Warshall

Edge processing:             → Edge List
  Examples: Kruskal's MST, Bellman-Ford
```

## Best Practices

1. **Default to adjacency list** — most real-world graphs are sparse.
2. **Use adjacency matrix** for dense graphs or Floyd-Warshall all-pairs shortest path.
3. **Use edge list** for Kruskal's algorithm or when edges are the primary data.
4. **For directed graphs**, only store one direction in the adjacency list/matrix.
5. **Consider compressed representations** (CSR — Compressed Sparse Row) for very large sparse graphs.

## Anti-patterns / Common Mistakes

- **Adjacency matrix for sparse graphs** — wastes O(V^2) memory; a graph with 1M nodes would need 1TB.
- **Linear search in edge list for neighbor queries** — O(E) per query is unacceptable.
- **Forgetting to add both directions** for undirected graphs in adjacency lists.
- **Not handling disconnected vertices** — ensure all vertices appear in the adjacency list, even with empty neighbors.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Complete Guide to Graph Data Structure (singhajit.com)](https://singhajit.com/data-structures/graph/)
- Skiena, S. (2008). *The Algorithm Design Manual* (2nd ed.). Springer.
