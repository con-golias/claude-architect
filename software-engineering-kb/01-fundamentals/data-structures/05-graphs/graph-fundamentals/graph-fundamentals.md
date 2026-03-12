# Graph Fundamentals

> **Domain:** Fundamentals > Data Structures > Graphs
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A graph is a non-linear data structure consisting of **vertices (nodes)** connected by **edges (links)**. Graphs model relationships and connections — social networks, maps, dependencies, networks, and countless other domains where pairwise relationships exist.

## Why It Matters

- **Models real-world relationships** — social networks, road maps, the internet, molecular structures.
- **Foundation for critical algorithms** — shortest path, network flow, topological sort, cycle detection.
- **Ubiquitous in software** — dependency resolution (npm, Maven), garbage collection, recommendation engines.
- **Graph databases** — Neo4j, Amazon Neptune model data as graphs for relationship-heavy queries.

## How It Works

### Terminology

```
Vertices (V) = {A, B, C, D, E}
Edges (E) = {(A,B), (A,C), (B,D), (C,D), (D,E)}

    A ─── B
    |     |
    C ─── D ─── E

Key terms:
- Vertex (node): A point in the graph
- Edge (link): A connection between two vertices
- Degree: Number of edges connected to a vertex (deg(D) = 3)
- Path: Sequence of vertices connected by edges (A → C → D → E)
- Cycle: Path that starts and ends at the same vertex (A → B → D → C → A)
- Connected: Every vertex is reachable from every other vertex
- Component: A maximal connected subgraph
```

### Types of Graphs

| Type | Description | Example |
|------|-------------|---------|
| **Undirected** | Edges have no direction | Friendships |
| **Directed (digraph)** | Edges have direction (A→B ≠ B→A) | Twitter follows |
| **Weighted** | Edges have values/costs | Road distances |
| **Unweighted** | All edges equal | Network hops |
| **Cyclic** | Contains at least one cycle | Road networks |
| **Acyclic** | No cycles | DAG (dependency graphs) |
| **DAG** | Directed Acyclic Graph | Build systems, task scheduling |
| **Complete** | Every vertex connects to every other | K_n |
| **Bipartite** | Vertices split into two sets, edges only between sets | Matching problems |
| **Sparse** | |E| ≈ |V| | Social networks |
| **Dense** | |E| ≈ |V|² | Complete or near-complete graphs |

### Directed Acyclic Graphs (DAGs)

```
DAG — no cycles, has topological ordering:

    A → B → D
    ↓       ↑
    C ──────┘

Topological sort: A, B, C, D  or  A, C, B, D
Used for: build systems, task scheduling, data pipelines
```

### Properties and Formulas

```
Undirected graph with |V| vertices:
- Maximum edges: |V| × (|V| - 1) / 2
- Sum of all degrees = 2 × |E|

Directed graph:
- Maximum edges: |V| × (|V| - 1)
- Sum of in-degrees = Sum of out-degrees = |E|

Tree: connected acyclic graph with |V| - 1 edges
```

## Best Practices

1. **Choose the right graph type** — directed vs undirected, weighted vs unweighted.
2. **Identify if the graph is a DAG** — enables topological sort and simpler algorithms.
3. **Consider sparsity** — most real-world graphs are sparse; use adjacency lists.
4. **Watch for disconnected components** — not all graphs are fully connected.

## Anti-patterns / Common Mistakes

- **Assuming connectivity** — always check if the graph is connected before running algorithms.
- **Ignoring edge direction** — directed and undirected graphs require different algorithms.
- **Using the wrong representation** — adjacency matrix for sparse graphs wastes O(V^2) memory.
- **Not handling self-loops or parallel edges** — some graphs allow these; handle or disallow explicitly.

## Real-world Examples

- **Social networks** — Facebook (undirected friendships), Twitter (directed follows).
- **Maps and navigation** — Google Maps uses weighted directed graphs for routing.
- **Internet** — the web is a directed graph of pages linked by hyperlinks.
- **Package managers** — npm, pip, Maven model dependencies as DAGs.
- **Circuit design** — electronic circuits modeled as graphs for analysis.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Skiena, S. (2008). *The Algorithm Design Manual* (2nd ed.). Springer.
- [FreeCodeCamp — Graph Algorithms in Python](https://www.freecodecamp.org/news/graph-algorithms-in-python-bfs-dfs-and-beyond/)
