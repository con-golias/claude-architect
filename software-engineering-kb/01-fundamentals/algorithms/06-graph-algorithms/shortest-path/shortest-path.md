# Shortest Path Algorithms

> **Domain:** Fundamentals > Algorithms > Graph > Shortest Path
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03-07

---

## What It Is

The shortest path problem asks: given a weighted graph, what is the path between two
vertices (or from one vertex to all others) with the minimum total edge weight?

Different algorithms solve different variants of this problem:

- **Single-source, unweighted:** BFS
- **Single-source, non-negative weights:** Dijkstra's algorithm
- **Single-source, any weights (including negative):** Bellman-Ford
- **Single-source, DAG:** Topological sort + relaxation
- **All-pairs:** Floyd-Warshall
- **Heuristic-guided:** A* (single-pair with admissible heuristic)

The core operation shared by most shortest path algorithms is **edge relaxation**:

```
if dist[u] + weight(u, v) < dist[v]:
    dist[v] = dist[u] + weight(u, v)
    predecessor[v] = u
```

---

## Algorithm Selection Guide

```
Scenario                                Algorithm         Time Complexity
────────────────────────────────────────────────────────────────────────────
Unweighted graph                        BFS               O(V + E)
Non-negative weights, single source     Dijkstra          O((V+E) log V)
Negative weights, single source         Bellman-Ford      O(V * E)
DAG, any weights                        DAG relaxation    O(V + E)
All-pairs shortest paths                Floyd-Warshall    O(V^3)
All-pairs, sparse, negative weights     Johnson's         O(V^2 log V + VE)
Single-pair with heuristic              A*                O(E) best case
```

**Decision flowchart:**

```
Start
  |
  v
Negative weights?
  |          |
  No         Yes
  |          |
  v          v
All-pairs?   DAG?
  |    |      |    |
  No   Yes    Yes  No
  |    |      |    |
  v    v      v    v
DAG?  Floyd   DAG  All-pairs?
|  |  Warshall  SP    |     |
Yes No                No    Yes
|   |                 |     |
v   v                 v     v
DAG Dijkstra     Bellman  Johnson's
SP                Ford
```

---

## Dijkstra's Algorithm

Dijkstra's algorithm finds the shortest paths from a single source vertex to all
other vertices in a graph with **non-negative** edge weights. It uses a greedy
strategy: always process the unvisited vertex with the smallest known distance.

### How It Works

1. Initialize distances: `dist[source] = 0`, all others = infinity.
2. Use a min-priority queue. Insert source with distance 0.
3. Extract the vertex `u` with minimum distance.
4. For each neighbor `v` of `u`, relax the edge (u, v).
5. Repeat until the queue is empty.

### Step-by-Step ASCII Trace

```
Weighted graph:

    A --2-- B --3-- E
    |       |       |
    4       1       6
    |       |       |
    C --5-- D --2-- F

Dijkstra from A:

Step  Extract   dist[A] dist[B] dist[C] dist[D] dist[E] dist[F]
────  ─────────  ──────  ──────  ──────  ──────  ──────  ──────
Init  -          0       inf     inf     inf     inf     inf
  1   A (d=0)    0       2       4       inf     inf     inf
  2   B (d=2)    0       2       4       3       5       inf
  3   D (d=3)    0       2       4       3       5       5
  4   C (d=4)    0       2       4       3       5       5
  5   E (d=5)    0       2       4       3       5       5*
  6   F (d=5)    0       2       4       3       5       5

  *F could also be updated to min(inf, 5+6=11, 3+2=5) = 5

Shortest path A -> F:  A -> B -> D -> F  (cost 2+1+2 = 5)
```

### Why Dijkstra Fails with Negative Weights

```
    A --1--> B
    |        |
    4       -5
    |        |
    +------> C

Dijkstra processes B first (dist=1), then C (dist=4).
But the actual shortest path to C is A->B->C = 1 + (-5) = -4.
Once B is "finalized" at distance 1, the greedy assumption says
we never need to revisit it. Negative edges violate this guarantee.
```

### Python Implementation

```python
import heapq
from typing import Optional

def dijkstra(
    graph: dict[int, list[tuple[int, float]]],
    source: int
) -> tuple[dict[int, float], dict[int, Optional[int]]]:
    """
    Dijkstra's shortest path algorithm using a min-heap.

    Args:
        graph: adjacency list {vertex: [(neighbor, weight), ...]}
        source: starting vertex

    Returns:
        (dist, prev) where:
          dist[v] = shortest distance from source to v
          prev[v] = predecessor of v on shortest path
    """
    dist: dict[int, float] = {}
    prev: dict[int, Optional[int]] = {}
    pq: list[tuple[float, int]] = [(0, source)]
    dist[source] = 0
    prev[source] = None

    while pq:
        d, u = heapq.heappop(pq)

        # Skip stale entries
        if d > dist.get(u, float('inf')):
            continue

        for v, weight in graph.get(u, []):
            new_dist = d + weight
            if new_dist < dist.get(v, float('inf')):
                dist[v] = new_dist
                prev[v] = u
                heapq.heappush(pq, (new_dist, v))

    return dist, prev


def reconstruct_path(prev: dict[int, Optional[int]], target: int) -> list[int]:
    """Reconstruct shortest path from predecessor map."""
    path = []
    current: Optional[int] = target
    while current is not None:
        path.append(current)
        current = prev.get(current)
    path.reverse()
    return path


# --- Example ---
graph = {
    0: [(1, 2), (2, 4)],       # A=0
    1: [(2, 1), (3, 7)],       # B=1
    2: [(3, 3)],                # C=2
    3: [(4, 1)],                # D=3
    4: [],                      # E=4
}

dist, prev = dijkstra(graph, 0)
print(dist)                         # {0: 0, 1: 2, 2: 3, 3: 6, 4: 7}
print(reconstruct_path(prev, 4))    # [0, 1, 2, 3, 4]
```

### TypeScript Implementation

```typescript
class MinHeap<T> {
  private data: [number, T][] = [];

  push(priority: number, value: T): void {
    this.data.push([priority, value]);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): [number, T] | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.data.length;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.data[parent][0] <= this.data[idx][0]) break;
      [this.data[parent], this.data[idx]] = [this.data[idx], this.data[parent]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.data[left][0] < this.data[smallest][0]) smallest = left;
      if (right < n && this.data[right][0] < this.data[smallest][0]) smallest = right;
      if (smallest === idx) break;
      [this.data[smallest], this.data[idx]] = [this.data[idx], this.data[smallest]];
      idx = smallest;
    }
  }
}

function dijkstra(
  graph: Map<number, [number, number][]>,
  source: number
): { dist: Map<number, number>; prev: Map<number, number | null> } {
  const dist = new Map<number, number>();
  const prev = new Map<number, number | null>();
  const pq = new MinHeap<number>();

  dist.set(source, 0);
  prev.set(source, null);
  pq.push(0, source);

  while (pq.size > 0) {
    const [d, u] = pq.pop()!;

    if (d > (dist.get(u) ?? Infinity)) continue;

    for (const [v, weight] of graph.get(u) ?? []) {
      const newDist = d + weight;
      if (newDist < (dist.get(v) ?? Infinity)) {
        dist.set(v, newDist);
        prev.set(v, u);
        pq.push(newDist, v);
      }
    }
  }

  return { dist, prev };
}

function reconstructPath(prev: Map<number, number | null>, target: number): number[] {
  const path: number[] = [];
  let current: number | null | undefined = target;
  while (current != null) {
    path.push(current);
    current = prev.get(current) ?? undefined;
  }
  return path.reverse();
}
```

### Java Implementation

```java
import java.util.*;

public class Dijkstra {

    public static Map<Integer, Long> dijkstra(
            Map<Integer, List<int[]>> graph,  // int[] = {neighbor, weight}
            int source) {

        Map<Integer, Long> dist = new HashMap<>();
        Map<Integer, Integer> prev = new HashMap<>();
        // PriorityQueue: [distance, vertex]
        PriorityQueue<long[]> pq = new PriorityQueue<>(
            Comparator.comparingLong(a -> a[0])
        );

        dist.put(source, 0L);
        pq.offer(new long[]{0, source});

        while (!pq.isEmpty()) {
            long[] top = pq.poll();
            long d = top[0];
            int u = (int) top[1];

            if (d > dist.getOrDefault(u, Long.MAX_VALUE)) continue;

            for (int[] edge : graph.getOrDefault(u, List.of())) {
                int v = edge[0];
                long weight = edge[1];
                long newDist = d + weight;

                if (newDist < dist.getOrDefault(v, Long.MAX_VALUE)) {
                    dist.put(v, newDist);
                    prev.put(v, u);
                    pq.offer(new long[]{newDist, v});
                }
            }
        }

        return dist;
    }

    public static List<Integer> reconstructPath(Map<Integer, Integer> prev, int target) {
        List<Integer> path = new ArrayList<>();
        Integer current = target;
        while (current != null) {
            path.add(current);
            current = prev.get(current);
        }
        Collections.reverse(path);
        return path;
    }
}
```

### Complexity Analysis

| Implementation | Time | Space |
|---|---|---|
| Binary heap (standard) | O((V + E) log V) | O(V + E) |
| Fibonacci heap | O(V log V + E) | O(V + E) |
| Array (no heap) | O(V^2) | O(V) |
| Dense graph + array | O(V^2) | O(V) |

### Real-World Applications

- **GPS navigation** (Google Maps, Waze) -- road networks with distances
- **Network routing** -- OSPF protocol uses Dijkstra
- **Social networks** -- degrees of separation
- **Flight booking** -- cheapest route between airports

---

## Bellman-Ford Algorithm

Bellman-Ford finds shortest paths from a single source and **handles negative edge
weights**. It can also detect **negative weight cycles**.

### How It Works

1. Initialize `dist[source] = 0`, all others = infinity.
2. Repeat V-1 times: relax ALL edges.
3. On the Vth iteration, if any edge can still be relaxed, a negative cycle exists.

### Why V-1 Iterations?

A shortest path in a graph with V vertices can have at most V-1 edges. Each iteration
guarantees that paths using one more edge are correctly computed. After V-1 iterations,
all shortest paths (up to V-1 edges) are found.

### Step-by-Step ASCII Trace

```
Graph with negative edge:

    A --4--> B
    |       / |
    2     -3  5
    |   /     |
    v v       v
    C --6--> D

Edges: (A,B,4), (A,C,2), (B,C,-3), (B,D,5), (C,D,6)

Bellman-Ford from A (processing edges in listed order):

        dist[A]  dist[B]  dist[C]  dist[D]
Init:      0       inf      inf      inf
Iter 1:    0        4        1*       9
           *B via A=4, C via A=2, then C via B=4-3=1, D via B=4+5=9
Iter 2:    0        4        1        7*
           *D via C = 1+6 = 7
Iter 3:    0        4        1        7   (no changes -- converged)

Shortest path A -> D:  A -> B -> C -> D is wrong, let's check:
  A->B->C = 4+(-3) = 1, then C->D = 1+6 = 7.   Correct!
  A->C->D = 2+6 = 8.  So going through B is shorter due to negative edge.
```

### Python Implementation

```python
def bellman_ford(
    vertices: list[int],
    edges: list[tuple[int, int, float]],
    source: int
) -> tuple[dict[int, float], dict[int, int | None], bool]:
    """
    Bellman-Ford single-source shortest path algorithm.

    Args:
        vertices: list of all vertex identifiers
        edges: list of (u, v, weight) tuples
        source: starting vertex

    Returns:
        (dist, prev, has_negative_cycle)
    """
    dist = {v: float('inf') for v in vertices}
    prev: dict[int, int | None] = {v: None for v in vertices}
    dist[source] = 0

    # Relax all edges V-1 times
    for i in range(len(vertices) - 1):
        updated = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                updated = True
        if not updated:
            break  # Early termination -- no changes this iteration

    # Check for negative cycles (Vth iteration)
    has_negative_cycle = False
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            has_negative_cycle = True
            break

    return dist, prev, has_negative_cycle


# --- Example ---
vertices = [0, 1, 2, 3, 4]
edges = [
    (0, 1, 4), (0, 2, 2), (1, 2, -3),
    (1, 3, 5), (2, 3, 6), (3, 4, 2),
]

dist, prev, neg_cycle = bellman_ford(vertices, edges, 0)
print(f"Distances: {dist}")           # {0: 0, 1: 4, 2: 1, 3: 7, 4: 9}
print(f"Negative cycle: {neg_cycle}")  # False


# --- Example with negative cycle ---
edges_neg = [
    (0, 1, 1), (1, 2, -1), (2, 0, -1),  # Cycle: 0->1->2->0, total = -1
    (0, 3, 5),
]
dist2, prev2, neg2 = bellman_ford([0, 1, 2, 3], edges_neg, 0)
print(f"Negative cycle: {neg2}")  # True
```

### TypeScript Implementation

```typescript
interface BFResult {
  dist: Map<number, number>;
  prev: Map<number, number | null>;
  hasNegativeCycle: boolean;
}

function bellmanFord(
  vertices: number[],
  edges: [number, number, number][],
  source: number
): BFResult {
  const dist = new Map<number, number>();
  const prev = new Map<number, number | null>();

  for (const v of vertices) {
    dist.set(v, Infinity);
    prev.set(v, null);
  }
  dist.set(source, 0);

  // Relax all edges V-1 times
  for (let i = 0; i < vertices.length - 1; i++) {
    let updated = false;
    for (const [u, v, w] of edges) {
      const newDist = dist.get(u)! + w;
      if (newDist < dist.get(v)!) {
        dist.set(v, newDist);
        prev.set(v, u);
        updated = true;
      }
    }
    if (!updated) break;
  }

  // Check for negative cycles
  let hasNegativeCycle = false;
  for (const [u, v, w] of edges) {
    if (dist.get(u)! + w < dist.get(v)!) {
      hasNegativeCycle = true;
      break;
    }
  }

  return { dist, prev, hasNegativeCycle };
}
```

### Real-World Applications

- **Currency arbitrage detection** -- currencies are vertices, exchange rates are edges,
  negative cycles mean arbitrage opportunities exist.
- **BGP routing (RIP protocol)** -- Bellman-Ford is used in distance-vector routing.
- **Network flow problems** -- as a subroutine in algorithms using negative-cost edges.

---

## Floyd-Warshall Algorithm

Floyd-Warshall computes shortest paths between **all pairs** of vertices. It uses
dynamic programming with the recurrence:

```
dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
```

for each intermediate vertex `k`.

### Step-by-Step Matrix Evolution

```
Graph:
    1 --3-- 2
    |      /|
    7    1  2
    |  /    |
    3 --5-- 4

Initial distance matrix:

       1     2     3     4
  1  [ 0     3     7    inf ]
  2  [ 3     0     1     2  ]
  3  [ 7     1     0     5  ]
  4  [ inf   2     5     0  ]

After k=1 (using vertex 1 as intermediate):
       1     2     3     4
  1  [ 0     3     7    inf ]
  2  [ 3     0     1     2  ]
  3  [ 7     1     0     5  ]
  4  [ inf   2     5     0  ]
  (No improvement using vertex 1)

After k=2 (using vertex 2 as intermediate):
       1     2     3     4
  1  [ 0     3     4*    5* ]     *1->2->3 = 3+1 = 4 < 7
  2  [ 3     0     1     2  ]     *1->2->4 = 3+2 = 5 < inf
  3  [ 4*    1     0     3* ]     *3->2->1 = 1+3 = 4 < 7
  4  [ 5*    2     3*    0  ]     *3->2->4 = 1+2 = 3 < 5
                                  *4->2->1 = 2+3 = 5 < inf
                                  *4->2->3 = 2+1 = 3 < 5

After k=3 and k=4 (no further improvements):
  Final matrix is same as after k=2.
```

### Python Implementation

```python
def floyd_warshall(
    num_vertices: int,
    edges: list[tuple[int, int, float]]
) -> tuple[list[list[float]], list[list[int | None]]]:
    """
    Floyd-Warshall all-pairs shortest path algorithm.

    Args:
        num_vertices: number of vertices (0-indexed)
        edges: list of (u, v, weight) tuples

    Returns:
        (dist, next_vertex) where:
          dist[i][j] = shortest distance from i to j
          next_vertex[i][j] = next vertex on shortest path from i to j
    """
    INF = float('inf')

    # Initialize distance and predecessor matrices
    dist = [[INF] * num_vertices for _ in range(num_vertices)]
    nxt = [[None] * num_vertices for _ in range(num_vertices)]

    # Distance from vertex to itself is 0
    for i in range(num_vertices):
        dist[i][i] = 0

    # Set direct edge weights
    for u, v, w in edges:
        dist[u][v] = w
        nxt[u][v] = v

    # Main DP: try each vertex as intermediate
    for k in range(num_vertices):
        for i in range(num_vertices):
            for j in range(num_vertices):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
                    nxt[i][j] = nxt[i][k]

    # Check for negative cycles (diagonal < 0)
    for i in range(num_vertices):
        if dist[i][i] < 0:
            raise ValueError(f"Negative cycle detected involving vertex {i}")

    return dist, nxt


def reconstruct_path_fw(nxt: list[list[int | None]], u: int, v: int) -> list[int]:
    """Reconstruct shortest path from u to v using the next-vertex matrix."""
    if nxt[u][v] is None:
        return []  # No path exists

    path = [u]
    while u != v:
        u = nxt[u][v]
        path.append(u)
    return path


# --- Example ---
edges = [
    (0, 1, 3), (0, 2, 7),
    (1, 0, 3), (1, 2, 1), (1, 3, 2),
    (2, 0, 7), (2, 1, 1), (2, 3, 5),
    (3, 1, 2), (3, 2, 5),
]

dist, nxt = floyd_warshall(4, edges)

# Print distance matrix
for row in dist:
    print([f"{x:5.1f}" if x != float('inf') else "  inf" for x in row])

print(reconstruct_path_fw(nxt, 0, 3))  # [0, 1, 3]
```

### Java Implementation

```java
import java.util.*;

public class FloydWarshall {

    static final long INF = Long.MAX_VALUE / 2;

    public static long[][] floydWarshall(int V, int[][] edges) {
        long[][] dist = new long[V][V];
        int[][] next = new int[V][V];

        // Initialize
        for (long[] row : dist) Arrays.fill(row, INF);
        for (int[] row : next) Arrays.fill(row, -1);
        for (int i = 0; i < V; i++) dist[i][i] = 0;

        // Set direct edges
        for (int[] edge : edges) {
            int u = edge[0], v = edge[1], w = edge[2];
            dist[u][v] = w;
            next[u][v] = v;
        }

        // DP with intermediate vertices
        for (int k = 0; k < V; k++) {
            for (int i = 0; i < V; i++) {
                for (int j = 0; j < V; j++) {
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                        next[i][j] = next[i][k];
                    }
                }
            }
        }

        return dist;
    }

    public static List<Integer> reconstructPath(int[][] next, int u, int v) {
        if (next[u][v] == -1) return List.of();
        List<Integer> path = new ArrayList<>();
        path.add(u);
        while (u != v) {
            u = next[u][v];
            path.add(u);
        }
        return path;
    }
}
```

### Complexity

- **Time:** O(V^3)
- **Space:** O(V^2)
- Works with negative weights (but no negative cycles)
- Simple to implement (triple nested loop)
- Also computes **transitive closure** (is there a path from i to j?)

### Real-World Applications

- **All-pairs shortest paths** in small-to-medium graphs (V up to ~5000)
- **Transitive closure** computation
- **Network analysis** -- finding the "center" of a network (vertex minimizing max
  distance to all others)

---

## A* Algorithm

A* is an informed search algorithm that combines Dijkstra's algorithm with a heuristic
function to guide exploration toward the goal. It computes:

```
f(n) = g(n) + h(n)
```

where:
- `g(n)` = actual cost from start to n
- `h(n)` = estimated cost from n to goal (heuristic)
- `f(n)` = estimated total cost through n

### Admissible Heuristics

A heuristic is **admissible** if it never overestimates the true cost. When the
heuristic is admissible, A* is guaranteed to find the optimal path.

| Heuristic | Formula | Best for |
|---|---|---|
| Manhattan distance | abs(x1-x2) + abs(y1-y2) | Grid, 4-directional movement |
| Euclidean distance | sqrt((x1-x2)^2 + (y1-y2)^2) | Grid, any-angle movement |
| Chebyshev distance | max(abs(x1-x2), abs(y1-y2)) | Grid, 8-directional movement |
| Zero (h=0) | 0 | Degenerates to Dijkstra |

### Grid Pathfinding Example (ASCII)

```
Grid (S=start, G=goal, #=wall, .=open):

  . . . . . . . .
  . . # # # . . .
  . S # . . . . .
  . . # . # # . .
  . . . . # G . .
  . . . . . . . .

A* path (using Manhattan distance heuristic):

  . . . . . . . .
  . * # # # . . .
  . S # . . . . .
  . * # . # # . .
  . . * * # G . .
  . . . . * * . .

  Path: S -> down -> down -> right -> right -> down -> right -> G

Explored nodes (numbered by order of exploration):

  . . . . . . . .
  . 2 # # # . . .
  . 1 # . . . . .    A* explores far fewer nodes than Dijkstra
  . 3 # . # # . .    because the heuristic guides it toward G.
  . . 4 5 # 7 . .
  . . . . 6 8 . .
```

### Python Implementation

```python
import heapq

def astar(
    grid: list[list[int]],
    start: tuple[int, int],
    goal: tuple[int, int]
) -> list[tuple[int, int]] | None:
    """
    A* pathfinding on a 2D grid.

    Args:
        grid: 2D grid where 0 = open, 1 = wall
        start: (row, col) starting position
        goal: (row, col) target position

    Returns:
        List of (row, col) positions forming the shortest path,
        or None if no path exists.
    """
    rows, cols = len(grid), len(grid[0])

    def heuristic(a: tuple[int, int], b: tuple[int, int]) -> int:
        """Manhattan distance."""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def neighbors(pos: tuple[int, int]) -> list[tuple[int, int]]:
        r, c = pos
        result = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 0:
                result.append((nr, nc))
        return result

    # Priority queue: (f_score, counter, position)
    counter = 0
    open_set = [(heuristic(start, goal), counter, start)]
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], float] = {start: 0}
    closed_set: set[tuple[int, int]] = set()

    while open_set:
        f, _, current = heapq.heappop(open_set)

        if current == goal:
            # Reconstruct path
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()
            return path

        if current in closed_set:
            continue
        closed_set.add(current)

        for neighbor in neighbors(current):
            if neighbor in closed_set:
                continue

            tentative_g = g_score[current] + 1  # uniform cost on grid

            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor, goal)
                counter += 1
                heapq.heappush(open_set, (f_score, counter, neighbor))

    return None  # No path found


# --- Example ---
grid = [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0],
]

path = astar(grid, (2, 0), (4, 5))
print(path)
# [(2,0), (3,0), (4,0), (4,1), (4,2), (4,3), (3,3), (2,3), (2,4), (2,5),
#  (3,5), (4,5)]  -- or similar optimal path
```

### TypeScript Implementation

```typescript
type Point = [number, number];

function astar(
  grid: number[][],
  start: Point,
  goal: Point
): Point[] | null {
  const rows = grid.length;
  const cols = grid[0].length;

  function heuristic(a: Point, b: Point): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); // Manhattan
  }

  function key(p: Point): string {
    return `${p[0]},${p[1]}`;
  }

  const gScore = new Map<string, number>();
  gScore.set(key(start), 0);

  const cameFrom = new Map<string, Point>();
  const closedSet = new Set<string>();

  // Simple priority queue using sorted array (use proper heap in production)
  const openSet: { f: number; pos: Point }[] = [
    { f: heuristic(start, goal), pos: start },
  ];

  const directions: Point[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (openSet.length > 0) {
    // Extract minimum f-score
    openSet.sort((a, b) => a.f - b.f);
    const { pos: current } = openSet.shift()!;
    const currentKey = key(current);

    if (current[0] === goal[0] && current[1] === goal[1]) {
      // Reconstruct path
      const path: Point[] = [current];
      let k = currentKey;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k)!;
        path.push(prev);
        k = key(prev);
      }
      return path.reverse();
    }

    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    for (const [dr, dc] of directions) {
      const nr = current[0] + dr;
      const nc = current[1] + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (grid[nr][nc] === 1) continue;

      const neighbor: Point = [nr, nc];
      const neighborKey = key(neighbor);
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        gScore.set(neighborKey, tentativeG);
        cameFrom.set(neighborKey, current);
        openSet.push({
          f: tentativeG + heuristic(neighbor, goal),
          pos: neighbor,
        });
      }
    }
  }

  return null;
}
```

### A* vs Dijkstra

```
                    Dijkstra                A*
                    (explores all)          (guided by heuristic)

         . . . . G                . . . . G
        * * * * *                 . . . * *
       * * * * *                  . . * * .
      * * * * * .                 . * * . .
     * * * * * . .                * * . . .
    S * * * * . . .              S * . . . .

  Dijkstra explores outward      A* focuses exploration
  in all directions equally.     toward the goal.
  More nodes explored.           Fewer nodes explored.
```

- A* with h(n) = 0 is exactly Dijkstra.
- A* is optimal when h(n) is admissible and consistent.
- In the worst case, A* explores as many nodes as Dijkstra.

---

## DAG Shortest Path

For directed acyclic graphs (DAGs), we can find shortest paths in **O(V + E)** time
by processing vertices in topological order and relaxing edges.

This is faster than Dijkstra and works with **negative weights** (as long as there
are no cycles, which DAGs guarantee).

### Python Implementation

```python
from collections import defaultdict

def dag_shortest_path(
    graph: dict[int, list[tuple[int, float]]],
    num_vertices: int,
    source: int
) -> dict[int, float]:
    """
    Shortest paths in a DAG using topological sort + relaxation.
    Time: O(V + E).  Works with negative weights.
    """
    # Step 1: Topological sort (DFS-based)
    visited = set()
    topo_order: list[int] = []

    def dfs(u: int):
        visited.add(u)
        for v, _ in graph.get(u, []):
            if v not in visited:
                dfs(v)
        topo_order.append(u)

    for v in range(num_vertices):
        if v not in visited:
            dfs(v)

    topo_order.reverse()

    # Step 2: Relax edges in topological order
    dist = {v: float('inf') for v in range(num_vertices)}
    dist[source] = 0

    for u in topo_order:
        if dist[u] == float('inf'):
            continue
        for v, weight in graph.get(u, []):
            if dist[u] + weight < dist[v]:
                dist[v] = dist[u] + weight

    return dist


# Example DAG
dag = {
    0: [(1, 5), (2, 3)],
    1: [(3, 6), (2, 2)],
    2: [(4, 4), (5, 2), (3, 7)],
    3: [(4, -1), (5, 1)],
    4: [(5, -2)],
    5: [],
}

dist = dag_shortest_path(dag, 6, 1)
print(dist)  # {0: inf, 1: 0, 2: 2, 3: 6, 4: 5, 5: 3}
```

**Why use this over Dijkstra for DAGs?**
- O(V + E) vs O((V+E) log V) -- no heap overhead.
- Handles negative edge weights (Dijkstra cannot).
- Simpler implementation for DAG inputs.

---

## Negative Cycle Detection

### Using Bellman-Ford

Run V-1 iterations of edge relaxation. If a Vth iteration finds any improvement,
a negative cycle is reachable from the source.

```python
def find_negative_cycle(
    vertices: list[int],
    edges: list[tuple[int, int, float]],
    source: int
) -> list[int] | None:
    """
    Detect and return a negative cycle if one exists.
    Returns the cycle as a list of vertices, or None.
    """
    dist = {v: float('inf') for v in vertices}
    prev: dict[int, int | None] = {v: None for v in vertices}
    dist[source] = 0

    # V-1 relaxations
    for _ in range(len(vertices) - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u

    # Vth iteration: find a vertex that can still be relaxed
    cycle_vertex = None
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            cycle_vertex = v
            break

    if cycle_vertex is None:
        return None

    # Trace back V times to ensure we're in the cycle
    v = cycle_vertex
    for _ in range(len(vertices)):
        v = prev[v]

    # Collect cycle vertices
    cycle = []
    u = v
    while True:
        cycle.append(u)
        u = prev[u]
        if u == v:
            cycle.append(u)
            break

    cycle.reverse()
    return cycle
```

### Johnson's Algorithm (All-Pairs with Negative Weights)

For sparse graphs with negative weights, Johnson's algorithm is more efficient than
Floyd-Warshall:

1. Add a new vertex `s` with zero-weight edges to all other vertices.
2. Run Bellman-Ford from `s` to get a potential function `h(v)`.
3. Reweight edges: `w'(u,v) = w(u,v) + h(u) - h(v)` (all non-negative).
4. Run Dijkstra from each vertex using reweighted edges.
5. Adjust distances back: `dist(u,v) = dist'(u,v) - h(u) + h(v)`.

**Time:** O(V^2 log V + VE) -- better than Floyd-Warshall O(V^3) for sparse graphs.

---

## Comprehensive Comparison Table

```
Algorithm        Negative  All-Pairs  Time              Space    Heuristic  Graph Type
                 Weights?                                        Required?
───────────────────────────────────────────────────────────────────────────────────────
BFS              No        No         O(V + E)          O(V)     No         Unweighted
Dijkstra         No        No         O((V+E) log V)    O(V+E)   No         Non-neg weights
Bellman-Ford     Yes       No         O(V * E)          O(V)     No         Any
Floyd-Warshall   Yes       Yes        O(V^3)            O(V^2)   No         Any (no neg cycles)
A*               No*       No         O(E) ~ O(V+E)     O(V)     Yes        Non-neg weights
DAG SP           Yes       No         O(V + E)          O(V)     No         DAG only
Johnson's        Yes       Yes        O(V^2 log V + VE) O(V^2)   No         Sparse + negative
```

*A* can technically work with negative weights if the heuristic is adjusted, but
this is uncommon in practice.

### Key Takeaways

1. **Unweighted graphs** -- just use BFS. Simple and optimal.
2. **Non-negative weights** -- Dijkstra is the workhorse. Use A* when you have a
   good heuristic and need single-pair queries.
3. **Negative weights** -- Bellman-Ford for single-source, Floyd-Warshall for
   all-pairs (small V), Johnson's for all-pairs (sparse).
4. **DAGs** -- topological sort + relaxation is the fastest single-source algorithm.
5. **Need to detect negative cycles?** -- Bellman-Ford.

---

## Sources

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022).
  *Introduction to Algorithms* (4th ed.), Chapters 24-25: Single-Source and
  All-Pairs Shortest Paths. MIT Press.
- Dijkstra, E. W. (1959). "A note on two problems in connexion with graphs."
  *Numerische Mathematik*, 1, 269-271.
- Bellman, R. (1958). "On a routing problem."
  *Quarterly of Applied Mathematics*, 16, 87-90.
- Ford, L. R. (1956). "Network Flow Theory." RAND Corporation report P-923.
- Floyd, R. W. (1962). "Algorithm 97: Shortest Path."
  *Communications of the ACM*, 5(6), 345.
- Warshall, S. (1962). "A Theorem on Boolean Matrices."
  *Journal of the ACM*, 9(1), 11-12.
- Hart, P. E., Nilsson, N. J., & Raphael, B. (1968). "A Formal Basis for the
  Heuristic Determination of Minimum Cost Paths."
  *IEEE Transactions on Systems Science and Cybernetics*, 4(2), 100-107.
- Johnson, D. B. (1977). "Efficient algorithms for shortest paths in sparse networks."
  *Journal of the ACM*, 24(1), 1-13.
- Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.), Chapter 4: Shortest
  Paths. Addison-Wesley.
- Wikipedia. "Dijkstra's algorithm," "Bellman-Ford algorithm," "Floyd-Warshall
  algorithm," "A* search algorithm."
  https://en.wikipedia.org/wiki/Shortest_path_problem
