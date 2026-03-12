# Binary Trees

> **Domain:** Fundamentals > Data Structures > Trees
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A binary tree is a hierarchical data structure where each node has at most **two children**, referred to as the left child and right child. It is the foundation for binary search trees, heaps, expression trees, and many other specialized structures.

## Why It Matters

- **Foundation for BSTs, heaps, and tries** — understanding binary trees is prerequisite for all tree-based structures.
- **Natural representation of hierarchical data** — file systems, DOM, organizational charts.
- **Efficient algorithms** — many divide-and-conquer algorithms use binary tree structure.
- **Expression parsing** — compilers represent arithmetic expressions as binary trees.

## How It Works

### Structure

```
         1          ← root
        / \
       2   3        ← internal nodes
      / \   \
     4   5   6      ← leaves (4, 5, 6)

Terminology:
- Root: top node (1)
- Parent: node with children (1→2,3)
- Leaf: node with no children (4, 5, 6)
- Depth: distance from root (root=0, node 2=1, node 4=2)
- Height: longest path from node to leaf (root height=2)
```

### Types of Binary Trees

| Type | Definition |
|------|-----------|
| **Full** | Every node has 0 or 2 children |
| **Complete** | All levels filled except possibly the last, which fills left to right |
| **Perfect** | All internal nodes have 2 children, all leaves at same level |
| **Balanced** | Height difference between left and right subtrees ≤ 1 |
| **Degenerate** | Every internal node has exactly 1 child (effectively a linked list) |

```
Full:        Complete:     Perfect:     Degenerate:
    1            1            1            1
   / \          / \          / \            \
  2   3        2   3        2   3            2
 / \          / \          / \ / \            \
4   5        4   5        4  5 6  7            3
                                                \
                                                 4
```

### Node Definition

```typescript
class TreeNode<T> {
  data: T;
  left: TreeNode<T> | null;
  right: TreeNode<T> | null;

  constructor(data: T) {
    this.data = data;
    this.left = null;
    this.right = null;
  }
}
```

### Tree Traversals

The four fundamental traversal orders:

```
         1
        / \
       2   3
      / \
     4   5

Inorder   (Left, Root, Right): 4, 2, 5, 1, 3
Preorder  (Root, Left, Right): 1, 2, 4, 5, 3
Postorder (Left, Right, Root): 4, 5, 2, 3, 1
Level-order (BFS):             1, 2, 3, 4, 5
```

```python
# Recursive traversals
def inorder(node):
    if node is None: return
    inorder(node.left)
    print(node.data)    # process node
    inorder(node.right)

def preorder(node):
    if node is None: return
    print(node.data)    # process node
    preorder(node.left)
    preorder(node.right)

def postorder(node):
    if node is None: return
    postorder(node.left)
    postorder(node.right)
    print(node.data)    # process node

# Level-order (BFS) traversal
from collections import deque

def level_order(root):
    if not root: return
    queue = deque([root])
    while queue:
        node = queue.popleft()
        print(node.data)
        if node.left: queue.append(node.left)
        if node.right: queue.append(node.right)
```

```typescript
// Iterative inorder traversal (using explicit stack)
function inorderIterative<T>(root: TreeNode<T> | null): T[] {
  const result: T[] = [];
  const stack: TreeNode<T>[] = [];
  let current = root;

  while (current || stack.length > 0) {
    while (current) {
      stack.push(current);
      current = current.left;
    }
    current = stack.pop()!;
    result.push(current.data);
    current = current.right;
  }
  return result;
}
```

### Common Operations

| Operation | Time | Notes |
|-----------|------|-------|
| Traversal | O(n) | Visit every node |
| Height | O(n) | Recursively compute |
| Count nodes | O(n) | Traverse entire tree |
| Search (unordered) | O(n) | Must check every node |
| Insert (complete tree) | O(log n) | Level-order position |

### Height Calculation

```python
def height(node) -> int:
    if node is None:
        return -1  # or 0, depending on convention
    return 1 + max(height(node.left), height(node.right))
```

### Properties

```
For a binary tree with n nodes:
- Minimum height: ⌊log₂(n)⌋ (complete/balanced)
- Maximum height: n - 1 (degenerate/linked list)
- Perfect tree with height h has: 2^(h+1) - 1 nodes
- Maximum leaves: ⌈n/2⌉
- Internal nodes in a full tree: (n - 1) / 2
```

## Best Practices

1. **Use recursion for tree problems** — trees are inherently recursive structures.
2. **Consider iterative approaches for deep trees** — avoid stack overflow on trees with millions of nodes.
3. **Choose the right traversal** — inorder for sorted BST output, preorder for serialization, postorder for deletion.
4. **Level-order for shortest path** in unweighted trees.

## Anti-patterns / Common Mistakes

- **Not handling null nodes** — every recursive call must check for null.
- **Confusing depth and height** — depth is top-down (root=0), height is bottom-up (leaf=0).
- **Stack overflow on deep trees** — use iterative traversal with explicit stack for very deep trees.
- **Assuming balanced** — a general binary tree can be highly unbalanced (degenerate).

## Real-world Examples

- **Expression trees** — compilers represent `(3 + 4) * 5` as a binary tree.
- **Huffman coding** — binary tree for optimal prefix coding (compression).
- **Decision trees** — machine learning models for classification.
- **DOM tree** — HTML document structure (though not strictly binary).
- **File system paths** — binary representation of directory hierarchies.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [GeeksforGeeks — Types of Binary Tree](https://www.geeksforgeeks.org/types-of-binary-tree/)
- [GeeksforGeeks — Types of Trees](https://www.geeksforgeeks.org/types-of-trees-in-data-structures/)
