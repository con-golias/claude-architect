# B-Trees

> **Domain:** Fundamentals > Data Structures > Trees
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

A B-tree is a self-balancing tree data structure optimized for systems that read and write large blocks of data — particularly **disk-based storage**. Unlike binary trees where each node has at most 2 children, a B-tree node can have hundreds or thousands of children, which minimizes the number of disk I/O operations needed to find a record.

B-trees are the foundation of nearly every database index and file system in existence.

## Why It Matters

- **Designed for disk I/O** — minimizes expensive disk reads by maximizing data per node.
- **Foundation of databases** — MySQL (InnoDB), PostgreSQL, SQLite, MongoDB all use B-tree variants.
- **Foundation of file systems** — NTFS, HFS+, ext4, Btrfs use B-trees.
- **Guaranteed O(log n)** with a very small base — a B-tree with branching factor 1000 needs only 3 levels for 1 billion keys.

## How It Works

### Structure

A B-tree of order m (minimum degree t):
- Each node has at most **m children** and **m-1 keys**.
- Each non-root node has at least **⌈m/2⌉ children**.
- All leaves are at the **same level** (perfectly balanced).
- Keys within a node are **sorted**.

```
B-tree of order 3 (each node has 2-3 children):

           [10 | 20]
          /    |    \
    [3|5]   [12|15]   [25|30|35]
```

### Why B-trees Excel on Disk

```
Binary tree with 1 billion keys:
  Height ≈ 30 → 30 disk reads per lookup

B-tree with branching factor 1000:
  Height ≈ 3 → 3 disk reads per lookup

Each node fits in one disk page (typically 4KB-16KB)
Reading one node = one disk seek + one block read
```

### B-tree vs B+ tree

| Property | B-tree | B+ tree |
|----------|--------|---------|
| Data storage | In all nodes | Only in leaf nodes |
| Leaf links | None | Leaves linked (sequential scan) |
| Range queries | Slower (traverse tree) | Fast (follow leaf links) |
| Node utilization | Lower | Higher (no data in internal nodes) |
| Used by | General purpose | Most databases (InnoDB, PostgreSQL) |

```
B+ tree structure:
              [10 | 20]           ← internal nodes (keys only)
             /    |    \
       [3|5|8] [12|15|18] [22|25|30]  ← leaf nodes (keys + data)
          ↔          ↔          ↔       ← leaves linked for range scans
```

### Operations and Time Complexity

| Operation | Time | Disk I/O |
|-----------|------|----------|
| Search | O(log n) | O(log_m n) |
| Insert | O(log n) | O(log_m n) |
| Delete | O(log n) | O(log_m n) |
| Range scan | O(log n + k) | O(log_m n + k/m) |

Where m is the branching factor (typically 100-1000).

### Insertion with Node Splitting

```
Insert 8 into this B-tree (order 3, max 2 keys per node):

   [5 | 10]
  /   |    \
[2|3] [7|8] [12|15]

Insert 6 → node [6|7|8] has 3 keys → SPLIT!

      [5 | 7 | 10]         ← 7 promoted to parent
     /   |   |    \
  [2|3] [6] [8] [12|15]

If parent is also full → split propagates up (may increase tree height)
```

### Conceptual Implementation

```python
class BTreeNode:
    def __init__(self, leaf=True):
        self.keys = []        # sorted keys
        self.children = []    # child pointers
        self.leaf = leaf      # is this a leaf node?

class BTree:
    def __init__(self, t):
        """t = minimum degree (each node has t-1 to 2t-1 keys)"""
        self.root = BTreeNode()
        self.t = t

    def search(self, node, key):
        """O(log n) — search for a key."""
        i = 0
        while i < len(node.keys) and key > node.keys[i]:
            i += 1
        if i < len(node.keys) and key == node.keys[i]:
            return (node, i)
        if node.leaf:
            return None
        return self.search(node.children[i], key)
```

### Real Numbers

```
PostgreSQL B-tree index on a table with 100 million rows:
- Branching factor: ~400 (8KB pages, ~20-byte keys)
- Tree height: 4 levels
- Lookup: 4 page reads (typically 3 cached → 1 disk read)
- Each page: 8,192 bytes

4 levels × 400 children = 400^4 = 25.6 billion possible keys
```

## Best Practices

1. **Use B+ trees for databases** — linked leaves enable efficient range scans.
2. **Choose node size = disk page size** — one node per I/O operation.
3. **Keep keys small** — more keys per node = higher branching factor = shorter tree.
4. **Use composite keys carefully** — the leftmost prefix determines index usability.
5. **Monitor tree height** — in practice, B-tree heights rarely exceed 4-5 levels.

## Anti-patterns / Common Mistakes

- **Using B-trees for in-memory data** — Red-Black trees or hash tables are faster in memory.
- **Ignoring the index order** — a B-tree index on `(last_name, first_name)` won't help queries on `first_name` alone.
- **Over-indexing** — each index is a B-tree that must be maintained on every write.
- **Not using EXPLAIN** — query planners show whether indexes are being used.

## Real-world Examples

- **MySQL InnoDB** — clustered B+ tree index; every table IS a B+ tree sorted by primary key.
- **PostgreSQL** — default index type is B-tree.
- **SQLite** — entire database is a collection of B-trees.
- **NTFS file system** — Master File Table uses B+ trees.
- **MongoDB** — WiredTiger storage engine uses B+ trees for indexes.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Bayer, R. & McCreight, E. (1972). "Organization and Maintenance of Large Ordered Indices."
- [Use The Index, Luke (use-the-index-luke.com)](https://use-the-index-luke.com/)
