# Graph Traversal Algorithms

> **Domain:** Fundamentals > Algorithms > Graph > Traversal
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-07

---

## What It Is

Graph traversal (also called graph search) is the process of systematically visiting
all vertices and edges in a graph. The two fundamental approaches are:

- **Breadth-First Search (BFS)** — explores level by level, visiting all neighbors at
  the current depth before moving to the next depth level.
- **Depth-First Search (DFS)** — explores as deep as possible along each branch before
  backtracking.

These traversals form the backbone of nearly every graph algorithm. Understanding them
is prerequisite to topological sorting, shortest-path algorithms, cycle detection,
connectivity analysis, and dozens of other graph problems.

---

## Graph Representation

Before traversing a graph, we need to represent it in memory. There are three common
representations, each with different trade-offs.

### 1. Adjacency Matrix

A 2D array `matrix[i][j]` where a non-zero value indicates an edge from vertex `i`
to vertex `j`. For weighted graphs, the value is the edge weight.

```
Vertices: 0, 1, 2, 3

    0  1  2  3
0 [ 0  1  1  0 ]      0 --- 1
1 [ 1  0  0  1 ]      |       \
2 [ 1  0  0  1 ]      2 ----- 3
3 [ 0  1  1  0 ]
```

- **Space:** O(V^2)
- **Edge lookup:** O(1)
- **Iterate neighbors:** O(V)
- **Best for:** dense graphs where E is close to V^2

**Python:**

```python
class AdjacencyMatrix:
    """Graph representation using a 2D matrix."""

    def __init__(self, num_vertices: int):
        self.V = num_vertices
        self.matrix = [[0] * num_vertices for _ in range(num_vertices)]

    def add_edge(self, u: int, v: int, weight: int = 1, directed: bool = False):
        self.matrix[u][v] = weight
        if not directed:
            self.matrix[v][u] = weight

    def has_edge(self, u: int, v: int) -> bool:
        return self.matrix[u][v] != 0

    def neighbors(self, u: int) -> list[int]:
        return [v for v in range(self.V) if self.matrix[u][v] != 0]

    def __repr__(self) -> str:
        rows = [" ".join(str(x) for x in row) for row in self.matrix]
        return "\n".join(rows)
```

**TypeScript:**

```typescript
class AdjacencyMatrix {
  private matrix: number[][];
  readonly V: number;

  constructor(numVertices: number) {
    this.V = numVertices;
    this.matrix = Array.from({ length: numVertices }, () =>
      new Array(numVertices).fill(0)
    );
  }

  addEdge(u: number, v: number, weight = 1, directed = false): void {
    this.matrix[u][v] = weight;
    if (!directed) this.matrix[v][u] = weight;
  }

  hasEdge(u: number, v: number): boolean {
    return this.matrix[u][v] !== 0;
  }

  neighbors(u: number): number[] {
    return this.matrix[u]
      .map((w, idx) => (w !== 0 ? idx : -1))
      .filter((idx) => idx !== -1);
  }
}
```

### 2. Adjacency List

An array (or map) of lists, where each vertex maps to a list of its neighbors.
This is the **preferred representation** for most graph algorithms because real-world
graphs tend to be sparse.

```
0: [1, 2]        0 --- 1
1: [0, 3]        |       \
2: [0, 3]        2 ----- 3
3: [1, 2]
```

- **Space:** O(V + E)
- **Edge lookup:** O(degree(u))
- **Iterate neighbors:** O(degree(u))
- **Best for:** sparse graphs (most real-world graphs)

**Python:**

```python
from collections import defaultdict

class AdjacencyList:
    """Graph representation using adjacency lists."""

    def __init__(self, directed: bool = False):
        self.adj: dict[int, list[tuple[int, float]]] = defaultdict(list)
        self.directed = directed

    def add_edge(self, u: int, v: int, weight: float = 1.0):
        self.adj[u].append((v, weight))
        if not self.directed:
            self.adj[v].append((u, weight))

    def neighbors(self, u: int) -> list[tuple[int, float]]:
        return self.adj[u]

    def vertices(self) -> set[int]:
        verts = set()
        for u in self.adj:
            verts.add(u)
            for v, _ in self.adj[u]:
                verts.add(v)
        return verts

    def __repr__(self) -> str:
        return "\n".join(f"{u}: {nbrs}" for u, nbrs in sorted(self.adj.items()))
```

**TypeScript:**

```typescript
class AdjacencyList {
  private adj: Map<number, [number, number][]> = new Map();
  private directed: boolean;

  constructor(directed = false) {
    this.directed = directed;
  }

  addEdge(u: number, v: number, weight = 1): void {
    if (!this.adj.has(u)) this.adj.set(u, []);
    this.adj.get(u)!.push([v, weight]);

    if (!this.directed) {
      if (!this.adj.has(v)) this.adj.set(v, []);
      this.adj.get(v)!.push([u, weight]);
    }
  }

  neighbors(u: number): [number, number][] {
    return this.adj.get(u) ?? [];
  }

  vertices(): Set<number> {
    const verts = new Set<number>();
    for (const [u, neighbors] of this.adj) {
      verts.add(u);
      for (const [v] of neighbors) verts.add(v);
    }
    return verts;
  }
}
```

### 3. Edge List

A simple list of edges `(u, v, weight)`. Useful for algorithms that process edges
one at a time (e.g., Kruskal's MST, Bellman-Ford).

```
[(0,1,5), (0,2,3), (1,3,2), (2,3,7)]
```

- **Space:** O(E)
- **Edge lookup:** O(E)
- **Best for:** Kruskal's algorithm, input parsing, edge-centric algorithms

**Python:**

```python
from dataclasses import dataclass

@dataclass
class Edge:
    u: int
    v: int
    weight: float = 1.0

class EdgeList:
    """Graph representation using a list of edges."""

    def __init__(self, directed: bool = False):
        self.edges: list[Edge] = []
        self.directed = directed

    def add_edge(self, u: int, v: int, weight: float = 1.0):
        self.edges.append(Edge(u, v, weight))

    def sorted_by_weight(self) -> list[Edge]:
        return sorted(self.edges, key=lambda e: e.weight)

    def vertices(self) -> set[int]:
        verts = set()
        for e in self.edges:
            verts.add(e.u)
            verts.add(e.v)
        return verts
```

**TypeScript:**

```typescript
interface Edge {
  u: number;
  v: number;
  weight: number;
}

class EdgeList {
  edges: Edge[] = [];
  private directed: boolean;

  constructor(directed = false) {
    this.directed = directed;
  }

  addEdge(u: number, v: number, weight = 1): void {
    this.edges.push({ u, v, weight });
  }

  sortedByWeight(): Edge[] {
    return [...this.edges].sort((a, b) => a.weight - b.weight);
  }

  vertices(): Set<number> {
    const verts = new Set<number>();
    for (const e of this.edges) {
      verts.add(e.u);
      verts.add(e.v);
    }
    return verts;
  }
}
```

---

## BFS (Breadth-First Search)

BFS explores a graph level by level, starting from a source vertex. It uses a
**queue (FIFO)** to process vertices in the order they are discovered.

### How It Works

```
Graph:                   BFS from vertex A:

    A --- B              Level 0:  A
    | \   |              Level 1:  B, C           (neighbors of A)
    |  \  |              Level 2:  D              (neighbors of B, C not yet visited)
    C --- D --- E        Level 3:  E              (neighbor of D not yet visited)

Step-by-step:
  Queue: [A]         Visit A.   Enqueue neighbors B, C
  Queue: [B, C]      Visit B.   Enqueue neighbor D (A already visited)
  Queue: [C, D]      Visit C.   D already enqueued
  Queue: [D]         Visit D.   Enqueue neighbor E
  Queue: [E]         Visit E.   Done.

  Visit order: A -> B -> C -> D -> E
```

- **Time Complexity:** O(V + E) -- each vertex and edge is processed once
- **Space Complexity:** O(V) -- for the visited set and queue
- **Data Structure:** Queue (FIFO)

### Python Implementation

```python
from collections import deque

def bfs(graph: dict[int, list[int]], start: int) -> list[int]:
    """
    Breadth-First Search traversal.

    Args:
        graph: adjacency list { vertex: [neighbors] }
        start: source vertex

    Returns:
        List of vertices in BFS visit order.
    """
    visited = set()
    queue = deque([start])
    visited.add(start)
    order = []

    while queue:
        vertex = queue.popleft()
        order.append(vertex)

        for neighbor in graph[vertex]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    return order


def bfs_shortest_path(graph: dict, start: int, end: int) -> list[int] | None:
    """
    Find shortest path in unweighted graph using BFS.

    Returns the path as a list of vertices, or None if no path exists.
    """
    if start == end:
        return [start]

    visited = {start}
    queue = deque([(start, [start])])

    while queue:
        vertex, path = queue.popleft()

        for neighbor in graph[vertex]:
            if neighbor == end:
                return path + [neighbor]
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))

    return None  # No path found


def bfs_level_order(graph: dict, start: int) -> list[list[int]]:
    """
    BFS that returns vertices grouped by level (distance from start).
    """
    visited = {start}
    queue = deque([start])
    levels = []

    while queue:
        level_size = len(queue)
        current_level = []

        for _ in range(level_size):
            vertex = queue.popleft()
            current_level.append(vertex)

            for neighbor in graph[vertex]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        levels.append(current_level)

    return levels


# --- Example usage ---
graph = {
    'A': ['B', 'C'],
    'B': ['A', 'D'],
    'C': ['A', 'D'],
    'D': ['B', 'C', 'E'],
    'E': ['D']
}

print(bfs(graph, 'A'))                       # ['A', 'B', 'C', 'D', 'E']
print(bfs_shortest_path(graph, 'A', 'E'))    # ['A', 'B', 'D', 'E'] or ['A', 'C', 'D', 'E']
print(bfs_level_order(graph, 'A'))           # [['A'], ['B', 'C'], ['D'], ['E']]
```

### TypeScript Implementation

```typescript
function bfs(graph: Map<string, string[]>, start: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);
  const order: string[] = [];

  while (queue.length > 0) {
    const vertex = queue.shift()!;
    order.push(vertex);

    for (const neighbor of graph.get(vertex) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return order;
}

function bfsShortestPath(
  graph: Map<string, string[]>,
  start: string,
  end: string
): string[] | null {
  if (start === end) return [start];

  const visited = new Set<string>([start]);
  const queue: [string, string[]][] = [[start, [start]]];

  while (queue.length > 0) {
    const [vertex, path] = queue.shift()!;

    for (const neighbor of graph.get(vertex) ?? []) {
      if (neighbor === end) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }

  return null;
}

// Usage
const graph = new Map<string, string[]>([
  ["A", ["B", "C"]],
  ["B", ["A", "D"]],
  ["C", ["A", "D"]],
  ["D", ["B", "C", "E"]],
  ["E", ["D"]],
]);

console.log(bfs(graph, "A"));                  // ['A', 'B', 'C', 'D', 'E']
console.log(bfsShortestPath(graph, "A", "E")); // ['A', 'B', 'D', 'E']
```

### Java Implementation

```java
import java.util.*;

public class BFS {

    /**
     * Standard BFS traversal returning visit order.
     */
    public static List<Integer> bfs(Map<Integer, List<Integer>> graph, int start) {
        List<Integer> order = new ArrayList<>();
        Set<Integer> visited = new HashSet<>();
        Queue<Integer> queue = new LinkedList<>();

        visited.add(start);
        queue.add(start);

        while (!queue.isEmpty()) {
            int vertex = queue.poll();
            order.add(vertex);

            for (int neighbor : graph.getOrDefault(vertex, List.of())) {
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.add(neighbor);
                }
            }
        }

        return order;
    }

    /**
     * BFS shortest path in unweighted graph.
     * Returns the shortest distance from start to every reachable vertex.
     */
    public static Map<Integer, Integer> bfsDistances(
            Map<Integer, List<Integer>> graph, int start) {

        Map<Integer, Integer> dist = new HashMap<>();
        Queue<Integer> queue = new LinkedList<>();

        dist.put(start, 0);
        queue.add(start);

        while (!queue.isEmpty()) {
            int u = queue.poll();
            for (int v : graph.getOrDefault(u, List.of())) {
                if (!dist.containsKey(v)) {
                    dist.put(v, dist.get(u) + 1);
                    queue.add(v);
                }
            }
        }

        return dist;
    }
}
```

### BFS Applications

| Application | How BFS Helps |
|---|---|
| Shortest path (unweighted) | First time BFS reaches a vertex, it's the shortest path |
| Level-order tree traversal | BFS naturally visits nodes level by level |
| Connected components | Run BFS from each unvisited vertex |
| Bipartite checking | 2-color vertices; conflict means not bipartite |
| Web crawling | Visit pages by link distance from seed URL |
| Social network k-degree friends | BFS up to depth k from a user |
| Puzzle solving (e.g., 15-puzzle) | States are vertices; moves are edges |

---

## DFS (Depth-First Search)

DFS explores as deep as possible along each branch before backtracking. It uses a
**stack** (explicit or via recursion's call stack).

### How It Works

```
Graph:                    DFS from vertex A (choosing leftmost neighbor first):

    A --- B               Stack trace:
    | \   |                 Push A
    |  \  |                 Pop A  -> visit A, push [C, B]
    C --- D --- E           Pop B  -> visit B, push [D]  (A already visited)
                            Pop D  -> visit D, push [E, C] (B visited)
                            Pop C  -> visit C  (A, D visited)
                            Pop E  -> visit E  (D visited)

  Visit order: A -> B -> D -> E -> C     (goes deep before backtracking)

  DFS Tree:
      A
     / \
    B   C
    |
    D
    |
    E
```

- **Time Complexity:** O(V + E)
- **Space Complexity:** O(V) -- for the visited set and stack/recursion depth
- **Data Structure:** Stack (LIFO) or recursion

### Python Implementation (Recursive)

```python
def dfs_recursive(graph: dict[str, list[str]], start: str) -> list[str]:
    """DFS using recursion (implicit stack)."""
    visited = set()
    order = []

    def _dfs(vertex: str):
        visited.add(vertex)
        order.append(vertex)
        for neighbor in graph[vertex]:
            if neighbor not in visited:
                _dfs(neighbor)

    _dfs(start)
    return order
```

### Python Implementation (Iterative)

```python
def dfs_iterative(graph: dict[str, list[str]], start: str) -> list[str]:
    """DFS using an explicit stack."""
    visited = set()
    stack = [start]
    order = []

    while stack:
        vertex = stack.pop()
        if vertex in visited:
            continue
        visited.add(vertex)
        order.append(vertex)

        # Push neighbors in reverse order so leftmost is processed first
        for neighbor in reversed(graph[vertex]):
            if neighbor not in visited:
                stack.append(neighbor)

    return order


def dfs_all_paths(graph: dict, start: str, end: str) -> list[list[str]]:
    """Find ALL paths from start to end using DFS backtracking."""
    all_paths = []

    def _backtrack(vertex: str, path: list[str]):
        if vertex == end:
            all_paths.append(path[:])
            return
        for neighbor in graph[vertex]:
            if neighbor not in path:  # avoid cycles
                path.append(neighbor)
                _backtrack(neighbor, path)
                path.pop()

    _backtrack(start, [start])
    return all_paths
```

### TypeScript Implementation (Recursive)

```typescript
function dfsRecursive(graph: Map<string, string[]>, start: string): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs(vertex: string): void {
    visited.add(vertex);
    order.push(vertex);
    for (const neighbor of graph.get(vertex) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }
  }

  dfs(start);
  return order;
}
```

### TypeScript Implementation (Iterative)

```typescript
function dfsIterative(graph: Map<string, string[]>, start: string): string[] {
  const visited = new Set<string>();
  const stack: string[] = [start];
  const order: string[] = [];

  while (stack.length > 0) {
    const vertex = stack.pop()!;
    if (visited.has(vertex)) continue;

    visited.add(vertex);
    order.push(vertex);

    const neighbors = graph.get(vertex) ?? [];
    for (let i = neighbors.length - 1; i >= 0; i--) {
      if (!visited.has(neighbors[i])) {
        stack.push(neighbors[i]);
      }
    }
  }

  return order;
}
```

### DFS Applications

| Application | How DFS Helps |
|---|---|
| Topological sorting | Reverse postorder of DFS gives topological order |
| Cycle detection | Back edges in DFS tree indicate cycles |
| Connected components | Run DFS from each unvisited vertex |
| Strongly connected components | Tarjan's or Kosaraju's (both DFS-based) |
| Path finding | DFS explores all possible paths |
| Maze generation/solving | Random DFS creates mazes; DFS solves them |
| Bridges and articulation points | Track discovery/low times in DFS |
| Biconnected components | Extension of bridge-finding |

---

## Topological Sort

A topological ordering of a directed acyclic graph (DAG) is a linear ordering of
vertices such that for every directed edge (u, v), vertex u comes before v.

```
DAG example (course prerequisites):

  CS101 --> CS201 --> CS301
    |                   ^
    +-----> CS202 ------+
               |
               v
             CS303

  One valid topological order:  CS101, CS201, CS202, CS301, CS303
  Another valid order:          CS101, CS202, CS201, CS303, CS301
```

A topological sort only exists if the graph has **no cycles** (i.e., it is a DAG).

### Method 1: DFS-based (Reverse Postorder)

```python
def topological_sort_dfs(graph: dict[int, list[int]], num_vertices: int) -> list[int]:
    """
    Topological sort using DFS.
    Vertices are added to result in reverse postorder.

    Args:
        graph: adjacency list for a DAG
        num_vertices: total number of vertices

    Returns:
        List of vertices in topological order.

    Raises:
        ValueError: if graph contains a cycle.
    """
    WHITE, GRAY, BLACK = 0, 1, 2
    color = [WHITE] * num_vertices
    result = []

    def dfs(u: int):
        color[u] = GRAY  # currently being processed
        for v in graph.get(u, []):
            if color[v] == GRAY:
                raise ValueError("Graph contains a cycle — no topological order exists")
            if color[v] == WHITE:
                dfs(v)
        color[u] = BLACK  # fully processed
        result.append(u)

    for v in range(num_vertices):
        if color[v] == WHITE:
            dfs(v)

    result.reverse()
    return result


# Example
dag = {
    0: [1, 2],   # CS101 -> CS201, CS202
    1: [3],      # CS201 -> CS301
    2: [3, 4],   # CS202 -> CS301, CS303
    3: [],       # CS301
    4: [],       # CS303
}
print(topological_sort_dfs(dag, 5))  # [0, 2, 4, 1, 3] or similar valid order
```

### Method 2: Kahn's Algorithm (BFS with In-degree)

```python
from collections import deque

def topological_sort_kahn(graph: dict[int, list[int]], num_vertices: int) -> list[int]:
    """
    Kahn's algorithm for topological sort (BFS-based).

    Repeatedly removes vertices with in-degree 0.
    If all vertices are removed, the graph is a DAG.
    """
    # Calculate in-degrees
    in_degree = [0] * num_vertices
    for u in graph:
        for v in graph[u]:
            in_degree[v] += 1

    # Start with all vertices having in-degree 0
    queue = deque(v for v in range(num_vertices) if in_degree[v] == 0)
    result = []

    while queue:
        u = queue.popleft()
        result.append(u)

        for v in graph.get(u, []):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)

    if len(result) != num_vertices:
        raise ValueError("Graph contains a cycle — no topological order exists")

    return result


print(topological_sort_kahn(dag, 5))  # [0, 1, 2, 3, 4] or similar valid order
```

**Time Complexity:** O(V + E) for both methods.

### Use Cases for Topological Sort

- **Build systems:** Make, Gradle, npm scripts (dependencies determine build order)
- **Task scheduling:** Prerequisites must be completed before dependent tasks
- **Course planning:** Must complete prereqs before advanced courses
- **Spreadsheet cell evaluation:** Formulas depend on other cells
- **Package managers:** Resolve dependency installation order

---

## Cycle Detection

### In Undirected Graphs: DFS with Parent Tracking

A cycle exists if DFS encounters a visited vertex that is **not** the parent of the
current vertex.

```python
def has_cycle_undirected(graph: dict[int, list[int]], num_vertices: int) -> bool:
    """Detect cycle in undirected graph using DFS."""
    visited = set()

    def dfs(vertex: int, parent: int) -> bool:
        visited.add(vertex)
        for neighbor in graph.get(vertex, []):
            if neighbor not in visited:
                if dfs(neighbor, vertex):
                    return True
            elif neighbor != parent:
                return True  # Found a back edge -> cycle
        return False

    for v in range(num_vertices):
        if v not in visited:
            if dfs(v, -1):
                return True
    return False


# Undirected graph with cycle: 0-1-2-0
g_cycle = {0: [1, 2], 1: [0, 2], 2: [1, 0]}
print(has_cycle_undirected(g_cycle, 3))  # True

g_no_cycle = {0: [1], 1: [0, 2], 2: [1]}
print(has_cycle_undirected(g_no_cycle, 3))  # False
```

### In Directed Graphs: DFS with Coloring (White/Gray/Black)

In a directed graph, a back edge (edge to a gray/in-progress vertex) indicates a cycle.

```python
def has_cycle_directed(graph: dict[int, list[int]], num_vertices: int) -> bool:
    """
    Detect cycle in directed graph using 3-color DFS.

    WHITE (0) = unvisited
    GRAY  (1) = in current DFS path (being processed)
    BLACK (2) = fully processed
    """
    WHITE, GRAY, BLACK = 0, 1, 2
    color = [WHITE] * num_vertices

    def dfs(u: int) -> bool:
        color[u] = GRAY
        for v in graph.get(u, []):
            if color[v] == GRAY:
                return True   # Back edge -> cycle
            if color[v] == WHITE and dfs(v):
                return True
        color[u] = BLACK
        return False

    for v in range(num_vertices):
        if color[v] == WHITE:
            if dfs(v):
                return True
    return False


# Directed graph with cycle: 0->1->2->0
dg_cycle = {0: [1], 1: [2], 2: [0]}
print(has_cycle_directed(dg_cycle, 3))  # True

# DAG (no cycle): 0->1->2
dg_dag = {0: [1], 1: [2], 2: []}
print(has_cycle_directed(dg_dag, 3))  # False
```

---

## Connected Components

### Undirected: BFS/DFS from Each Unvisited Vertex

```python
def connected_components(graph: dict[int, list[int]], num_vertices: int) -> list[list[int]]:
    """Find all connected components in an undirected graph."""
    visited = set()
    components = []

    def bfs(start: int) -> list[int]:
        from collections import deque
        component = []
        queue = deque([start])
        visited.add(start)
        while queue:
            v = queue.popleft()
            component.append(v)
            for neighbor in graph.get(v, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        return component

    for v in range(num_vertices):
        if v not in visited:
            components.append(bfs(v))

    return components


g = {0: [1], 1: [0], 2: [3], 3: [2], 4: []}
print(connected_components(g, 5))  # [[0, 1], [2, 3], [4]]
```

### Directed: Kosaraju's Algorithm for Strongly Connected Components

A **strongly connected component (SCC)** is a maximal set of vertices such that every
vertex is reachable from every other vertex in the set (following edge directions).

```python
def kosaraju_scc(graph: dict[int, list[int]], num_vertices: int) -> list[list[int]]:
    """
    Kosaraju's algorithm for Strongly Connected Components.

    Steps:
      1. Run DFS on original graph, record finish order.
      2. Build the transpose (reversed) graph.
      3. Run DFS on transpose in reverse finish order.
         Each DFS tree in step 3 is one SCC.
    """
    # Step 1: DFS on original graph, record finish order
    visited = set()
    finish_order = []

    def dfs1(u: int):
        visited.add(u)
        for v in graph.get(u, []):
            if v not in visited:
                dfs1(v)
        finish_order.append(u)

    for v in range(num_vertices):
        if v not in visited:
            dfs1(v)

    # Step 2: Build transpose graph
    transpose: dict[int, list[int]] = {v: [] for v in range(num_vertices)}
    for u in graph:
        for v in graph[u]:
            transpose[v].append(u)

    # Step 3: DFS on transpose in reverse finish order
    visited.clear()
    sccs = []

    def dfs2(u: int, component: list[int]):
        visited.add(u)
        component.append(u)
        for v in transpose.get(u, []):
            if v not in visited:
                dfs2(v, component)

    for v in reversed(finish_order):
        if v not in visited:
            component: list[int] = []
            dfs2(v, component)
            sccs.append(component)

    return sccs


# Directed graph with 2 SCCs: {0,1,2} and {3,4}
directed = {0: [1], 1: [2], 2: [0, 3], 3: [4], 4: [3]}
print(kosaraju_scc(directed, 5))  # [[0, 2, 1], [3, 4]] or equivalent
```

**Time Complexity:** O(V + E) for Kosaraju's algorithm.

---

## BFS vs DFS Comparison

```
Feature              BFS                      DFS
───────────────────────────────────────────────────────────────────────
Data Structure       Queue (FIFO)             Stack (LIFO) / Recursion
Exploration          Level by level           Branch by branch
Memory               O(V) -- proportional     O(V) -- proportional
                     to max width             to max depth
Shortest Path        Yes (unweighted)         No
Complete             Yes                      Yes (finite graphs)
Optimal              Yes (unweighted)         No
Traversal Type       Breadth-first            Depth-first
Best For             Nearest neighbor,        Exhaustive search,
                     shortest path            topological sort,
                                              cycle detection
Tree Traversal       Level-order              Pre/In/Post-order
Topological Sort     Kahn's algorithm         Reverse postorder
Cycle Detection      Possible but less        Natural (back edges)
                     natural
Connected            Either works             Preferred for SCCs
Components                                    (Tarjan's, Kosaraju's)
```

### When to Choose BFS

- You need the **shortest path** in an unweighted graph.
- You need to find vertices at a **specific distance** from the source.
- The solution is likely **close to the source** (small depth).
- You need **level-order** information.

### When to Choose DFS

- You need to **detect cycles**.
- You need a **topological sort**.
- You need to find **all paths** or **all solutions**.
- The graph is very **deep but narrow** (DFS uses less memory).
- You need **strongly connected components**.
- You're implementing **backtracking** (e.g., puzzles, constraint satisfaction).

---

## Bipartite Graph Checking (BFS Application)

A graph is bipartite if its vertices can be colored with two colors such that no
two adjacent vertices share the same color.

```python
from collections import deque

def is_bipartite(graph: dict[int, list[int]], num_vertices: int) -> bool:
    """
    Check if a graph is bipartite using BFS 2-coloring.
    """
    color = [-1] * num_vertices

    for start in range(num_vertices):
        if color[start] != -1:
            continue

        queue = deque([start])
        color[start] = 0

        while queue:
            u = queue.popleft()
            for v in graph.get(u, []):
                if color[v] == -1:
                    color[v] = 1 - color[u]
                    queue.append(v)
                elif color[v] == color[u]:
                    return False  # Same color on adjacent vertices

    return True


bipartite_graph = {0: [1, 3], 1: [0, 2], 2: [1, 3], 3: [2, 0]}
print(is_bipartite(bipartite_graph, 4))  # True (even cycle)

non_bipartite = {0: [1, 2], 1: [0, 2], 2: [0, 1]}
print(is_bipartite(non_bipartite, 3))  # False (odd cycle / triangle)
```

---

## Complexity Summary

```
Algorithm             Time         Space     Notes
──────────────────────────────────────────────────────────────────
BFS                   O(V + E)     O(V)      Queue-based, level-order
DFS (recursive)       O(V + E)     O(V)      Call stack depth up to V
DFS (iterative)       O(V + E)     O(V)      Explicit stack
Topological Sort      O(V + E)     O(V)      DFS or Kahn's; DAG only
Cycle Detection       O(V + E)     O(V)      DFS with coloring
Connected Components  O(V + E)     O(V)      BFS/DFS on each component
Kosaraju's SCC        O(V + E)     O(V + E)  Two DFS passes + transpose
Tarjan's SCC          O(V + E)     O(V)      Single DFS pass
Bipartite Check       O(V + E)     O(V)      BFS 2-coloring
```

---

## Sources

- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022).
  *Introduction to Algorithms* (4th ed.), Chapter 22: Elementary Graph Algorithms.
  MIT Press.
- Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.), Chapter 4: Graphs.
  Addison-Wesley.
- Skiena, S. S. (2020). *The Algorithm Design Manual* (3rd ed.), Chapter 7: Graph
  Traversal. Springer.
- Tarjan, R. E. (1972). "Depth-First Search and Linear Graph Algorithms."
  *SIAM Journal on Computing*, 1(2), 146-160.
- cp-algorithms.com — Graph Traversals (BFS, DFS).
  https://cp-algorithms.com/graph/breadth-first-search.html
- Wikipedia. "Breadth-first search," "Depth-first search," "Topological sorting."
  https://en.wikipedia.org/wiki/Breadth-first_search
