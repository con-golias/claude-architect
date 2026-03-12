# Weighted Graphs and Shortest Path Algorithms

> **Domain:** Fundamentals > Data Structures > Graphs
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A weighted graph is a graph where each edge has an associated numerical value (weight/cost). Weights can represent distances, costs, capacities, latencies, or any metric. Weighted graphs require specialized algorithms — BFS alone cannot find shortest paths when edges have different weights.

## Why It Matters

- **Navigation** — finding shortest routes with actual distances/travel times.
- **Network routing** — minimizing latency or maximizing bandwidth.
- **Resource allocation** — minimum cost flow, assignment problems.
- **Critical infrastructure** — minimum spanning trees for network design.

## How It Works

### Dijkstra's Algorithm

Finds shortest paths from a single source to all vertices. Works with **non-negative weights only**.

```
Time: O((V + E) log V) with binary heap
Time: O(V² + E) with array (better for dense graphs)

Algorithm:
1. Set distance[source] = 0, all others = ∞
2. Add source to priority queue
3. Extract minimum distance vertex
4. For each neighbor: if shorter path found, update distance
5. Repeat until queue is empty
```

```python
import heapq

def dijkstra(graph: dict, start: str) -> dict[str, float]:
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    previous = {node: None for node in graph}
    pq = [(0, start)]

    while pq:
        dist, node = heapq.heappop(pq)
        if dist > distances[node]:
            continue  # stale entry

        for neighbor, weight in graph[node]:
            new_dist = dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                previous[neighbor] = node
                heapq.heappush(pq, (new_dist, neighbor))

    return distances

def reconstruct_path(previous: dict, start: str, end: str) -> list[str]:
    path = []
    node = end
    while node is not None:
        path.append(node)
        node = previous[node]
    return path[::-1] if path[-1] == start else []
```

### Bellman-Ford Algorithm

Handles **negative weights** (but not negative cycles). Detects negative cycles.

```
Time: O(V × E)

Algorithm:
1. Set distance[source] = 0, all others = ∞
2. Repeat V-1 times: relax all edges
3. One more pass: if any distance decreases → negative cycle exists
```

```python
def bellman_ford(vertices: list, edges: list, start: str) -> dict | None:
    distances = {v: float('inf') for v in vertices}
    distances[start] = 0

    # Relax all edges V-1 times
    for _ in range(len(vertices) - 1):
        for u, v, weight in edges:
            if distances[u] + weight < distances[v]:
                distances[v] = distances[u] + weight

    # Check for negative cycles
    for u, v, weight in edges:
        if distances[u] + weight < distances[v]:
            return None  # negative cycle detected

    return distances
```

### Floyd-Warshall Algorithm

Finds shortest paths between **all pairs** of vertices.

```
Time: O(V³)
Space: O(V²)
Works with negative weights (detects negative cycles)
```

```python
def floyd_warshall(graph_matrix: list[list[float]]) -> list[list[float]]:
    n = len(graph_matrix)
    dist = [row[:] for row in graph_matrix]  # copy

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]

    # Check for negative cycles (diagonal < 0)
    for i in range(n):
        if dist[i][i] < 0:
            raise ValueError("Negative cycle detected")

    return dist
```

### Minimum Spanning Tree (MST)

A spanning tree that connects all vertices with minimum total edge weight.

**Prim's Algorithm** (grow tree from a vertex):
```python
def prim(graph: dict, start: str) -> list[tuple]:
    mst = []
    visited = {start}
    edges = [(weight, start, neighbor) for neighbor, weight in graph[start]]
    heapq.heapify(edges)

    while edges and len(visited) < len(graph):
        weight, u, v = heapq.heappop(edges)
        if v in visited:
            continue
        visited.add(v)
        mst.append((u, v, weight))
        for neighbor, w in graph[v]:
            if neighbor not in visited:
                heapq.heappush(edges, (w, v, neighbor))

    return mst
```

**Kruskal's Algorithm** (sort edges, add if no cycle):
```python
def kruskal(vertices: list, edges: list) -> list[tuple]:
    parent = {v: v for v in vertices}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path compression
            x = parent[x]
        return x

    def union(x, y):
        parent[find(x)] = find(y)

    edges.sort(key=lambda e: e[2])  # sort by weight
    mst = []
    for u, v, w in edges:
        if find(u) != find(v):
            union(u, v)
            mst.append((u, v, w))
    return mst
```

### Algorithm Comparison

| Algorithm | Time | Space | Negative Weights | All-Pairs | Use Case |
|-----------|------|-------|-----------------|-----------|----------|
| Dijkstra | O((V+E)log V) | O(V) | No | No | GPS navigation |
| Bellman-Ford | O(V×E) | O(V) | Yes | No | Exchange rates |
| Floyd-Warshall | O(V³) | O(V²) | Yes | Yes | All-pairs (small graphs) |
| A* | O(E) best | O(V) | No | No | Game pathfinding |
| Prim | O((V+E)log V) | O(V) | N/A | N/A | Dense MST |
| Kruskal | O(E log E) | O(V) | N/A | N/A | Sparse MST |

### A* Algorithm (Heuristic Search)

Extension of Dijkstra with a heuristic function for faster goal-directed search:

```python
def a_star(graph, start, goal, heuristic):
    open_set = [(heuristic(start, goal), 0, start)]  # (f, g, node)
    g_score = {start: 0}

    while open_set:
        f, g, node = heapq.heappop(open_set)
        if node == goal:
            return g  # shortest distance

        for neighbor, weight in graph[node]:
            new_g = g + weight
            if new_g < g_score.get(neighbor, float('inf')):
                g_score[neighbor] = new_g
                f = new_g + heuristic(neighbor, goal)
                heapq.heappush(open_set, (f, new_g, neighbor))

    return float('inf')  # no path
```

## Best Practices

1. **Use Dijkstra for non-negative weights** — most common scenario (maps, networks).
2. **Use Bellman-Ford only when negative weights exist** — it's slower than Dijkstra.
3. **Use Floyd-Warshall for all-pairs on small graphs** — O(V^3) is prohibitive for large graphs.
4. **Use A* with a good heuristic** for point-to-point shortest path — much faster than Dijkstra.
5. **Choose Kruskal for sparse MST, Prim for dense MST.**

## Anti-patterns / Common Mistakes

- **Using Dijkstra with negative weights** — produces incorrect results.
- **Floyd-Warshall on large graphs** — O(V^3) is impractical for V > ~5000.
- **Forgetting to detect negative cycles** in Bellman-Ford.
- **Using BFS on weighted graphs** — BFS only works for unweighted shortest paths.

## Real-world Examples

- **Google Maps** — Dijkstra/A* with contraction hierarchies for routing.
- **Network routing** — OSPF protocol uses Dijkstra for shortest-path routing.
- **Currency arbitrage** — Bellman-Ford detects negative cycles in exchange rate graphs.
- **Cable/power grid design** — MST minimizes total cable length.
- **Game AI** — A* for NPC pathfinding on game maps.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Dijkstra, E.W. (1959). "A note on two problems in connexion with graphs."
- [FreeCodeCamp — Graph Algorithms in Python](https://www.freecodecamp.org/news/graph-algorithms-in-python-bfs-dfs-and-beyond/)
