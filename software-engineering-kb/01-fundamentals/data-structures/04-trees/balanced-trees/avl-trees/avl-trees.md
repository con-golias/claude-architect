# AVL Trees

> **Domain:** Fundamentals > Data Structures > Trees > Balanced Trees
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

An AVL tree (Adelson-Velsky and Landis, 1962) is a **self-balancing binary search tree** where the heights of the left and right subtrees of every node differ by at most 1. This balance factor guarantee ensures O(log n) worst-case time for search, insert, and delete operations — eliminating the degenerate O(n) case of plain BSTs.

## Why It Matters

- **Guaranteed O(log n)** — no degenerate cases unlike plain BSTs.
- **Strictly balanced** — more balanced than Red-Black trees, leading to faster lookups.
- **First self-balancing BST** — historically significant, still used where lookup speed is critical.
- **Optimal for read-heavy workloads** — stricter balancing means shorter trees and fewer comparisons.

## How It Works

### Balance Factor

```
Balance Factor (BF) = height(left subtree) - height(right subtree)

Valid AVL: BF ∈ {-1, 0, 1}

       5 (BF=1)         5 (BF=2)  ← INVALID!
      / \               / \
     3   7 (BF=0)      3   7
    /                  / \
   2                  2   4
                     /
                    1
```

### Rotations

When an insertion or deletion violates the balance property, the tree is rebalanced using rotations:

**Right Rotation (LL case):**
```
    z (BF=2)         y
   / \              / \
  y   T4    →      x   z
 / \              /   / \
x   T3           T1  T3  T4
|
T1
```

**Left Rotation (RR case):**
```
  z (BF=-2)         y
 / \                / \
T1   y      →      z   x
    / \            / \   \
   T2  x          T1  T2  T3
        \
        T3
```

**Left-Right Rotation (LR case):**
```
    z               z               x
   / \             / \             / \
  y   T4   →      x   T4   →     y   z
 / \             / \             /   / \
T1  x           y   T3         T1  T3  T4
   / \         / \
  T2  T3      T1  T2
  (left on y)           (right on z)
```

**Right-Left Rotation (RL case):**
```
  z               z                 x
 / \             / \               / \
T1   y    →     T1   x      →    z   y
    / \             / \          / \   \
   x   T4         T2  y        T1  T2  T4
  / \                 / \
 T2  T3              T3  T4
 (right on y)           (left on z)
```

### Implementation (Insert with Rebalancing)

```python
class AVLNode:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None
        self.height = 0

class AVLTree:
    def _height(self, node):
        return node.height if node else -1

    def _balance_factor(self, node):
        return self._height(node.left) - self._height(node.right)

    def _update_height(self, node):
        node.height = 1 + max(self._height(node.left), self._height(node.right))

    def _rotate_right(self, z):
        y = z.left
        z.left = y.right
        y.right = z
        self._update_height(z)
        self._update_height(y)
        return y

    def _rotate_left(self, z):
        y = z.right
        z.right = y.left
        y.left = z
        self._update_height(z)
        self._update_height(y)
        return y

    def _rebalance(self, node):
        self._update_height(node)
        bf = self._balance_factor(node)

        if bf > 1:  # left-heavy
            if self._balance_factor(node.left) < 0:
                node.left = self._rotate_left(node.left)  # LR case
            return self._rotate_right(node)                # LL case

        if bf < -1:  # right-heavy
            if self._balance_factor(node.right) > 0:
                node.right = self._rotate_right(node.right)  # RL case
            return self._rotate_left(node)                    # RR case

        return node  # already balanced

    def insert(self, node, key):
        if not node:
            return AVLNode(key)
        if key < node.key:
            node.left = self.insert(node.left, key)
        elif key > node.key:
            node.right = self.insert(node.right, key)
        return self._rebalance(node)
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Search | O(log n) | Guaranteed by balance |
| Insert | O(log n) | Insert + at most 2 rotations |
| Delete | O(log n) | Delete + up to O(log n) rotations |
| Min/Max | O(log n) | Follow left/right edge |

### AVL vs Red-Black Tree

| Property | AVL | Red-Black |
|----------|-----|-----------|
| Balance strictness | Height diff ≤ 1 | At most 2× height difference |
| Lookup speed | Faster (shorter height) | Slightly slower |
| Insert/Delete speed | Slower (more rotations) | Faster (fewer rotations) |
| Rotations per insert | Up to 2 | Up to 2 |
| Rotations per delete | Up to O(log n) | Up to 3 |
| Best for | Read-heavy workloads | Write-heavy workloads |

## Best Practices

1. **Use AVL for read-heavy workloads** — stricter balancing means faster lookups.
2. **Use Red-Black trees for write-heavy workloads** — fewer rotations on insert/delete.
3. **In practice, use library implementations** — `TreeMap` (Java), `std::set` (C++) use Red-Black trees.
4. **Store height in each node** — avoid recalculating height on every operation.

## Anti-patterns / Common Mistakes

- **Forgetting to update height after rotation** — the tree will appear balanced but heights will be stale.
- **Not handling all four rotation cases** — LL, RR, LR, RL each require different rotations.
- **Implementing from scratch in production** — use well-tested library implementations.
- **Choosing AVL when writes dominate** — Red-Black trees have fewer rotations per modification.

## Real-world Examples

- **In-memory databases** — AVL trees for fast lookup indexes.
- **Language dictionaries** — real-time spell checkers use balanced trees.
- **Linux kernel (some subsystems)** — AVL trees used in certain memory management paths.
- **Embedded systems** — where predictable worst-case performance is critical.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Adelson-Velsky, G.M. & Landis, E.M. (1962). "An algorithm for the organization of information."
- [Baeldung — Red-Black Tree vs AVL Tree](https://www.baeldung.com/cs/red-black-tree-vs-avl-tree)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
