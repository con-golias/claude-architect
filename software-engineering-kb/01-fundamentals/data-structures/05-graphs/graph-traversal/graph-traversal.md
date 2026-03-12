# Graph Traversal (BFS & DFS)

> **Domain:** Fundamentals > Data Structures > Graphs
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Graph traversal is the process of visiting all vertices in a graph systematically. The two fundamental traversal algorithms are **Breadth-First Search (BFS)**, which explores level by level using a queue, and **Depth-First Search (DFS)**, which explores as deep as possible before backtracking using a stack (or recursion).

## Why It Matters

- **BFS finds shortest paths** in unweighted graphs.
- **DFS detects cycles**, finds connected components, and enables topological sorting.
- **Foundation for all graph algorithms** — Dijkstra, Prim, Kruskal, and many others build on BFS/DFS.
- **Essential for coding interviews** — BFS and DFS are among the most frequently tested algorithms.

## How It Works

### BFS (Breadth-First Search)

Explores vertices in order of distance from the start — level by level.

```
Graph:          BFS from A:
A — B           Visit order: A, B, C, D, E, F
|   |           Level 0: A
C — D — E       Level 1: B, C
    |           Level 2: D
    F           Level 3: E, F
```

```python
from collections import deque

def bfs(graph: dict, start: str) -> list[str]:
    visited = set([start])
    queue = deque([start])
    order = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order
```

**BFS shortest path (unweighted):**

```python
def shortest_path(graph: dict, start: str, end: str) -> list[str] | None:
    if start == end:
        return [start]

    visited = set([start])
    queue = deque([(start, [start])])

    while queue:
        node, path = queue.popleft()
        for neighbor in graph[node]:
            if neighbor == end:
                return path + [neighbor]
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))
    return None  # no path exists
```

### DFS (Depth-First Search)

Explores as far as possible along each branch before backtracking.

```
Graph:          DFS from A (recursive):
A — B           Visit order: A, B, D, C, E, F
|   |           (goes deep before wide)
C — D — E
    |
    F
```

```python
# Recursive DFS
def dfs_recursive(graph: dict, start: str, visited: set = None) -> list[str]:
    if visited is None:
        visited = set()
    visited.add(start)
    order = [start]
    for neighbor in graph[start]:
        if neighbor not in visited:
            order.extend(dfs_recursive(graph, neighbor, visited))
    return order

# Iterative DFS (using explicit stack)
def dfs_iterative(graph: dict, start: str) -> list[str]:
    visited = set()
    stack = [start]
    order = []

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        # Push neighbors in reverse order for consistent left-to-right traversal
        for neighbor in reversed(graph[node]):
            if neighbor not in visited:
                stack.append(neighbor)
    return order
```

### BFS vs DFS Comparison

| Property | BFS | DFS |
|----------|-----|-----|
| Data structure | Queue (FIFO) | Stack (LIFO) / Recursion |
| Exploration pattern | Level by level | Branch by branch |
| Shortest path | Yes (unweighted) | No |
| Time complexity | O(V + E) | O(V + E) |
| Space complexity | O(V) worst | O(V) worst (O(h) typical) |
| Cycle detection | Possible | Natural |
| Topological sort | Kahn's algorithm (BFS) | Post-order DFS |
| Complete (finds all)? | Yes | Yes |
| When to use | Shortest path, level-order | Cycle detection, backtracking, topological sort |

### Cycle Detection with DFS

```python
# Directed graph cycle detection
def has_cycle(graph: dict) -> bool:
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node: WHITE for node in graph}

    def dfs(node: str) -> bool:
        color[node] = GRAY  # currently exploring
        for neighbor in graph[node]:
            if color[neighbor] == GRAY:
                return True  # back edge → cycle!
            if color[neighbor] == WHITE and dfs(neighbor):
                return True
        color[node] = BLACK  # fully explored
        return False

    return any(dfs(node) for node in graph if color[node] == WHITE)
```

### Topological Sort with DFS

```python
def topological_sort(graph: dict) -> list[str]:
    visited = set()
    order = []

    def dfs(node: str):
        visited.add(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                dfs(neighbor)
        order.append(node)  # post-order

    for node in graph:
        if node not in visited:
            dfs(node)

    return order[::-1]  # reverse post-order
```

### Connected Components

```python
def find_components(graph: dict) -> list[list[str]]:
    visited = set()
    components = []

    for node in graph:
        if node not in visited:
            component = []
            queue = deque([node])
            visited.add(node)
            while queue:
                current = queue.popleft()
                component.append(current)
                for neighbor in graph[current]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            components.append(component)
    return components
```

### Time and Space Complexity

| Algorithm | Time | Space | Notes |
|-----------|------|-------|-------|
| BFS | O(V + E) | O(V) | Queue can hold up to V nodes |
| DFS (recursive) | O(V + E) | O(h) | h = max recursion depth |
| DFS (iterative) | O(V + E) | O(V) | Stack can hold up to V nodes |

## Best Practices

1. **Use BFS for shortest path** in unweighted graphs — DFS does not guarantee shortest.
2. **Use iterative DFS for deep graphs** — recursive DFS can cause stack overflow.
3. **Always track visited nodes** — prevents infinite loops in cyclic graphs.
4. **Use DFS for topological sort and cycle detection** — more natural fit than BFS.
5. **Mark visited when enqueueing/pushing** (not when processing) — prevents duplicate work.

## Anti-patterns / Common Mistakes

- **Using DFS for shortest path** — DFS does not find shortest paths.
- **Marking visited on processing instead of discovery** — leads to duplicates in the queue/stack.
- **Forgetting to handle disconnected graphs** — run BFS/DFS from all unvisited vertices.
- **Recursive DFS on deep graphs** — stack overflow; use iterative with explicit stack.
- **Not reversing stack insertion order** — iterative DFS explores in reverse order unless neighbors are reversed.

## Real-world Examples

- **Social network friend suggestions** — BFS to find friends-of-friends.
- **Web crawlers** — BFS to discover pages level by level from a seed URL.
- **Maze solving** — DFS for exploring paths with backtracking.
- **Build systems** — topological sort (DFS) for dependency resolution.
- **Garbage collection** — DFS/BFS to identify reachable objects.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [FreeCodeCamp — Graph Algorithms in Python](https://www.freecodecamp.org/news/graph-algorithms-in-python-bfs-dfs-and-beyond/)
- [Wikipedia — Breadth-first Search](https://en.wikipedia.org/wiki/Breadth-first_search)
