# Tree Traversal and BST Operations

> **Domain:** Fundamentals > Algorithms > Tree > Traversal & BST
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-07

---

## What It Is

Tree algorithms operate on hierarchical data structures where each node has zero or more
children. **Binary trees** (at most two children per node) and **Binary Search Trees** (BSTs)
are the foundation for many efficient data structures and algorithms.

A **Binary Search Tree** enforces an ordering invariant: for every node `N`, all values in the
left subtree are less than `N`, and all values in the right subtree are greater than `N`. This
invariant enables O(log n) search, insert, and delete operations on balanced trees.

---

## Tree Node Definition

### Python

```python
class TreeNode:
    def __init__(self, val: int, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
```

### TypeScript

```typescript
class TreeNode {
    val: number;
    left: TreeNode | null;
    right: TreeNode | null;

    constructor(val: number, left: TreeNode | null = null, right: TreeNode | null = null) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
```

---

## Tree Traversals

All four traversals demonstrated on this tree:

```
           4
          / \
         2   6
        / \ / \
       1  3 5  7

  Inorder:    1, 2, 3, 4, 5, 6, 7    (sorted!)
  Preorder:   4, 2, 1, 3, 6, 5, 7
  Postorder:  1, 3, 2, 5, 7, 6, 4
  Level-order: 4, 2, 6, 1, 3, 5, 7
```

---

### Inorder Traversal (Left -> Root -> Right)

**Key property:** On a BST, inorder traversal visits nodes in ascending sorted order.

**Use cases:** BST validation, sorted output, finding kth smallest element.

#### Recursive (Python)

```python
def inorder_recursive(root: TreeNode | None) -> list[int]:
    """Inorder traversal: Left -> Root -> Right."""
    result = []

    def traverse(node: TreeNode | None):
        if node is None:
            return
        traverse(node.left)
        result.append(node.val)
        traverse(node.right)

    traverse(root)
    return result
```

#### Iterative with Stack (Python)

```python
def inorder_iterative(root: TreeNode | None) -> list[int]:
    """Iterative inorder traversal using explicit stack."""
    result = []
    stack = []
    current = root

    while current or stack:
        # Go as far left as possible
        while current:
            stack.append(current)
            current = current.left

        # Process node
        current = stack.pop()
        result.append(current.val)

        # Move to right subtree
        current = current.right

    return result
```

#### Iterative (TypeScript)

```typescript
function inorderIterative(root: TreeNode | null): number[] {
    const result: number[] = [];
    const stack: TreeNode[] = [];
    let current = root;

    while (current !== null || stack.length > 0) {
        while (current !== null) {
            stack.push(current);
            current = current.left;
        }
        current = stack.pop()!;
        result.push(current.val);
        current = current.right;
    }
    return result;
}
```

---

### Preorder Traversal (Root -> Left -> Right)

**Use cases:** Tree serialization/deserialization, copying a tree, prefix expression evaluation,
creating a tree from a preorder sequence.

#### Recursive (Python)

```python
def preorder_recursive(root: TreeNode | None) -> list[int]:
    """Preorder traversal: Root -> Left -> Right."""
    result = []

    def traverse(node: TreeNode | None):
        if node is None:
            return
        result.append(node.val)
        traverse(node.left)
        traverse(node.right)

    traverse(root)
    return result
```

#### Iterative with Stack (Python)

```python
def preorder_iterative(root: TreeNode | None) -> list[int]:
    """Iterative preorder traversal. Push right child first so left is processed first."""
    if root is None:
        return []

    result = []
    stack = [root]

    while stack:
        node = stack.pop()
        result.append(node.val)

        # Push right first so left is processed first (LIFO)
        if node.right:
            stack.append(node.right)
        if node.left:
            stack.append(node.left)

    return result
```

#### Iterative (TypeScript)

```typescript
function preorderIterative(root: TreeNode | null): number[] {
    if (root === null) return [];
    const result: number[] = [];
    const stack: TreeNode[] = [root];

    while (stack.length > 0) {
        const node = stack.pop()!;
        result.push(node.val);
        if (node.right) stack.push(node.right);
        if (node.left) stack.push(node.left);
    }
    return result;
}
```

---

### Postorder Traversal (Left -> Right -> Root)

**Use cases:** Tree deletion (delete children before parent), postfix expression evaluation,
calculating directory sizes (compute children first), dependency resolution.

#### Recursive (Python)

```python
def postorder_recursive(root: TreeNode | None) -> list[int]:
    """Postorder traversal: Left -> Right -> Root."""
    result = []

    def traverse(node: TreeNode | None):
        if node is None:
            return
        traverse(node.left)
        traverse(node.right)
        result.append(node.val)

    traverse(root)
    return result
```

#### Iterative with Two Stacks (Python)

```python
def postorder_iterative(root: TreeNode | None) -> list[int]:
    """Iterative postorder using two stacks."""
    if root is None:
        return []

    stack1 = [root]
    stack2 = []

    while stack1:
        node = stack1.pop()
        stack2.append(node)
        if node.left:
            stack1.append(node.left)
        if node.right:
            stack1.append(node.right)

    result = []
    while stack2:
        result.append(stack2.pop().val)
    return result
```

#### Iterative (TypeScript)

```typescript
function postorderIterative(root: TreeNode | null): number[] {
    if (root === null) return [];
    const stack1: TreeNode[] = [root];
    const stack2: TreeNode[] = [];

    while (stack1.length > 0) {
        const node = stack1.pop()!;
        stack2.push(node);
        if (node.left) stack1.push(node.left);
        if (node.right) stack1.push(node.right);
    }

    return stack2.reverse().map(node => node.val);
}
```

---

### Level-Order Traversal (BFS)

**Use cases:** Finding minimum depth, level averages, zigzag traversal, right side view,
connect nodes at same level, serialization.

#### Implementation (Python)

```python
from collections import deque


def level_order(root: TreeNode | None) -> list[list[int]]:
    """Level-order (BFS) traversal, returns values grouped by level."""
    if root is None:
        return []

    result = []
    queue = deque([root])

    while queue:
        level_size = len(queue)
        level_values = []

        for _ in range(level_size):
            node = queue.popleft()
            level_values.append(node.val)

            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)

        result.append(level_values)

    return result

# For tree above: [[4], [2, 6], [1, 3, 5, 7]]
```

#### Implementation (TypeScript)

```typescript
function levelOrder(root: TreeNode | null): number[][] {
    if (root === null) return [];

    const result: number[][] = [];
    const queue: TreeNode[] = [root];

    while (queue.length > 0) {
        const levelSize = queue.length;
        const levelValues: number[] = [];

        for (let i = 0; i < levelSize; i++) {
            const node = queue.shift()!;
            levelValues.push(node.val);
            if (node.left) queue.push(node.left);
            if (node.right) queue.push(node.right);
        }

        result.push(levelValues);
    }
    return result;
}
```

---

### Morris Traversal (O(1) Space Inorder)

Morris traversal achieves O(1) auxiliary space by temporarily modifying the tree structure
using **threaded binary tree** links. It creates temporary links from inorder predecessors
back to their successors.

```python
def morris_inorder(root: TreeNode | None) -> list[int]:
    """Inorder traversal with O(1) space (no stack, no recursion)."""
    result = []
    current = root

    while current:
        if current.left is None:
            # No left subtree -- visit current and go right
            result.append(current.val)
            current = current.right
        else:
            # Find inorder predecessor (rightmost in left subtree)
            predecessor = current.left
            while predecessor.right and predecessor.right != current:
                predecessor = predecessor.right

            if predecessor.right is None:
                # Create temporary thread back to current
                predecessor.right = current
                current = current.left
            else:
                # Thread already exists -- left subtree done
                predecessor.right = None  # Remove thread
                result.append(current.val)
                current = current.right

    return result
```

**Complexity:** Time O(n), Space O(1). Each edge is traversed at most twice.

---

## Traversal Complexity Summary

| Traversal  | Time | Space (Recursive)    | Space (Iterative) | Space (Morris) |
|------------|------|----------------------|--------------------|--------------  |
| Inorder    | O(n) | O(h) call stack      | O(h) stack         | O(1)           |
| Preorder   | O(n) | O(h) call stack      | O(h) stack         | O(1)           |
| Postorder  | O(n) | O(h) call stack      | O(h) stack         | O(1)           |
| Level-order| O(n) | N/A                  | O(w) queue         | N/A            |

Where `h` = height (log n balanced, n worst), `w` = max width (up to n/2).

---

## BST Operations

### Search

Follow left for smaller values, right for larger. O(h) time.

```python
def bst_search(root: TreeNode | None, target: int) -> TreeNode | None:
    """Search for target in BST. O(h) where h = tree height."""
    while root:
        if target == root.val:
            return root
        elif target < root.val:
            root = root.left
        else:
            root = root.right
    return None
```

```typescript
function bstSearch(root: TreeNode | null, target: number): TreeNode | null {
    let current = root;
    while (current !== null) {
        if (target === current.val) return current;
        else if (target < current.val) current = current.left;
        else current = current.right;
    }
    return null;
}
```

---

### Insert

Find the correct position (same path as search), then insert as a new leaf.

```python
def bst_insert(root: TreeNode | None, val: int) -> TreeNode:
    """Insert value into BST. Returns root of modified tree."""
    if root is None:
        return TreeNode(val)

    if val < root.val:
        root.left = bst_insert(root.left, val)
    elif val > root.val:
        root.right = bst_insert(root.right, val)
    # If val == root.val, duplicate -- skip (or handle as desired)

    return root
```

```typescript
function bstInsert(root: TreeNode | null, val: number): TreeNode {
    if (root === null) return new TreeNode(val);

    if (val < root.val) {
        root.left = bstInsert(root.left, val);
    } else if (val > root.val) {
        root.right = bstInsert(root.right, val);
    }
    return root;
}
```

---

### Delete

Three cases, increasing in complexity:

```
Case 1: Leaf Node -- Simply remove it.

    Delete 3:
        4              4
       / \            / \
      2   6    ->    2   6
     / \            /
    1   3          1


Case 2: One Child -- Replace node with its child.

    Delete 2 (has left child only):
        4              4
       / \            / \
      2   6    ->    1   6
     /
    1


Case 3: Two Children -- Replace with inorder successor (smallest in right subtree)
        OR inorder predecessor (largest in left subtree).

    Delete 4 (replace with inorder successor 5):
        4              5
       / \            / \
      2   6    ->    2   6
     / \ /          / \   \
    1  3 5         1   3   7
          \
           7
```

#### Implementation (Python)

```python
def bst_delete(root: TreeNode | None, val: int) -> TreeNode | None:
    """Delete value from BST. Returns root of modified tree."""
    if root is None:
        return None

    if val < root.val:
        root.left = bst_delete(root.left, val)
    elif val > root.val:
        root.right = bst_delete(root.right, val)
    else:
        # Found the node to delete

        # Case 1 & 2: Zero or one child
        if root.left is None:
            return root.right
        if root.right is None:
            return root.left

        # Case 3: Two children
        # Find inorder successor (smallest in right subtree)
        successor = root.right
        while successor.left:
            successor = successor.left

        root.val = successor.val
        root.right = bst_delete(root.right, successor.val)

    return root
```

#### Implementation (TypeScript)

```typescript
function bstDelete(root: TreeNode | null, val: number): TreeNode | null {
    if (root === null) return null;

    if (val < root.val) {
        root.left = bstDelete(root.left, val);
    } else if (val > root.val) {
        root.right = bstDelete(root.right, val);
    } else {
        // Found node to delete
        if (root.left === null) return root.right;
        if (root.right === null) return root.left;

        // Two children: find inorder successor
        let successor = root.right;
        while (successor.left !== null) {
            successor = successor.left;
        }
        root.val = successor.val;
        root.right = bstDelete(root.right, successor.val);
    }
    return root;
}
```

---

### Find Min / Max

```python
def find_min(root: TreeNode) -> int:
    """Follow leftmost path. O(h)."""
    while root.left:
        root = root.left
    return root.val


def find_max(root: TreeNode) -> int:
    """Follow rightmost path. O(h)."""
    while root.right:
        root = root.right
    return root.val
```

---

### Validate BST

Two approaches: range-based (preferred) and inorder-based.

#### Range-Based Validation (Python)

```python
def is_valid_bst(root: TreeNode | None,
                 min_val: float = float('-inf'),
                 max_val: float = float('inf')) -> bool:
    """Validate BST using valid range for each node."""
    if root is None:
        return True

    if root.val <= min_val or root.val >= max_val:
        return False

    return (is_valid_bst(root.left, min_val, root.val) and
            is_valid_bst(root.right, root.val, max_val))
```

#### Inorder Validation (Python)

```python
def is_valid_bst_inorder(root: TreeNode | None) -> bool:
    """Validate BST by checking inorder traversal is strictly increasing."""
    prev = [float('-inf')]

    def inorder(node: TreeNode | None) -> bool:
        if node is None:
            return True
        if not inorder(node.left):
            return False
        if node.val <= prev[0]:
            return False
        prev[0] = node.val
        return inorder(node.right)

    return inorder(root)
```

#### Validation (TypeScript)

```typescript
function isValidBST(
    root: TreeNode | null,
    min: number = -Infinity,
    max: number = Infinity
): boolean {
    if (root === null) return true;
    if (root.val <= min || root.val >= max) return false;
    return isValidBST(root.left, min, root.val) &&
           isValidBST(root.right, root.val, max);
}
```

---

## BST Operation Complexity

| Operation   | Balanced BST | Skewed BST (worst) |
|-------------|--------------|---------------------|
| Search      | O(log n)     | O(n)                |
| Insert      | O(log n)     | O(n)                |
| Delete      | O(log n)     | O(n)                |
| Find Min    | O(log n)     | O(n)                |
| Find Max    | O(log n)     | O(n)                |
| Successor   | O(log n)     | O(n)                |

**The problem:** Inserting sorted data into a plain BST creates a degenerate tree (linked list).
Solution: self-balancing BSTs.

---

## Self-Balancing BSTs

### AVL Tree

An AVL tree maintains a **balance factor** at each node:

```
Balance Factor = height(left subtree) - height(right subtree)
```

The balance factor must be **-1, 0, or 1** at every node. If an insertion or deletion violates
this, we perform **rotations** to restore balance.

#### Four Rotation Types

```
1. LEFT-LEFT (LL) Case -- Right Rotation:

        z                 y
       / \              /   \
      y   T4           x     z
     / \       ->     / \   / \
    x   T3           T1 T2 T3 T4
   / \
  T1  T2


2. RIGHT-RIGHT (RR) Case -- Left Rotation:

    z                    y
   / \                 /   \
  T1  y               z     x
     / \     ->       / \   / \
    T2  x            T1 T2 T3 T4
       / \
      T3  T4


3. LEFT-RIGHT (LR) Case -- Left then Right Rotation:

      z               z               x
     / \             / \            /    \
    y   T4          x   T4         y      z
   / \      ->     / \      ->    / \    / \
  T1  x           y   T3        T1  T2 T3  T4
     / \         / \
    T2  T3      T1  T2


4. RIGHT-LEFT (RL) Case -- Right then Left Rotation:

    z               z                  x
   / \             / \              /    \
  T1   y          T1  x            z      y
      / \    ->      / \    ->    / \    / \
     x   T4        T2   y       T1  T2 T3  T4
    / \                / \
   T2  T3             T3  T4
```

#### AVL Tree Implementation (Python)

```python
class AVLNode:
    def __init__(self, val: int):
        self.val = val
        self.left: AVLNode | None = None
        self.right: AVLNode | None = None
        self.height: int = 1


class AVLTree:
    def _height(self, node: AVLNode | None) -> int:
        return node.height if node else 0

    def _balance_factor(self, node: AVLNode) -> int:
        return self._height(node.left) - self._height(node.right)

    def _update_height(self, node: AVLNode) -> None:
        node.height = 1 + max(self._height(node.left), self._height(node.right))

    def _right_rotate(self, z: AVLNode) -> AVLNode:
        """Right rotation (LL case)."""
        y = z.left
        t3 = y.right

        y.right = z
        z.left = t3

        self._update_height(z)
        self._update_height(y)
        return y

    def _left_rotate(self, z: AVLNode) -> AVLNode:
        """Left rotation (RR case)."""
        y = z.right
        t2 = y.left

        y.left = z
        z.right = t2

        self._update_height(z)
        self._update_height(y)
        return y

    def _rebalance(self, node: AVLNode) -> AVLNode:
        """Rebalance the node if its balance factor is outside [-1, 1]."""
        self._update_height(node)
        bf = self._balance_factor(node)

        # Left-Left case
        if bf > 1 and self._balance_factor(node.left) >= 0:
            return self._right_rotate(node)

        # Left-Right case
        if bf > 1 and self._balance_factor(node.left) < 0:
            node.left = self._left_rotate(node.left)
            return self._right_rotate(node)

        # Right-Right case
        if bf < -1 and self._balance_factor(node.right) <= 0:
            return self._left_rotate(node)

        # Right-Left case
        if bf < -1 and self._balance_factor(node.right) > 0:
            node.right = self._right_rotate(node.right)
            return self._left_rotate(node)

        return node

    def insert(self, root: AVLNode | None, val: int) -> AVLNode:
        """Insert a value and rebalance. O(log n)."""
        if root is None:
            return AVLNode(val)

        if val < root.val:
            root.left = self.insert(root.left, val)
        elif val > root.val:
            root.right = self.insert(root.right, val)
        else:
            return root  # Duplicate

        return self._rebalance(root)

    def delete(self, root: AVLNode | None, val: int) -> AVLNode | None:
        """Delete a value and rebalance. O(log n)."""
        if root is None:
            return None

        if val < root.val:
            root.left = self.delete(root.left, val)
        elif val > root.val:
            root.right = self.delete(root.right, val)
        else:
            if root.left is None:
                return root.right
            if root.right is None:
                return root.left

            # Find inorder successor
            successor = root.right
            while successor.left:
                successor = successor.left
            root.val = successor.val
            root.right = self.delete(root.right, successor.val)

        return self._rebalance(root)


# Usage
avl = AVLTree()
root = None
for val in [10, 20, 30, 40, 50, 25]:
    root = avl.insert(root, val)

# Tree is balanced:
#        30
#       /  \
#      20   40
#     / \     \
#    10  25   50
```

### AVL Tree Properties

| Property       | Value             |
|----------------|-------------------|
| Height         | O(log n)          |
| Search         | O(log n)          |
| Insert         | O(log n)          |
| Delete         | O(log n)          |
| Space          | O(n)              |
| Rotations/op   | O(1) insert, O(log n) delete |

---

### Red-Black Tree (Overview)

Red-Black trees are a more relaxed self-balancing BST. Every node is colored red or black.

**Properties (invariants):**

1. Every node is either red or black
2. The root is black
3. Every leaf (NIL sentinel) is black
4. If a node is red, both its children are black (no two consecutive reds)
5. For each node, all paths to descendant leaves have the same **black-height**

**Compared to AVL:**

| Property           | AVL Tree              | Red-Black Tree           |
|--------------------|-----------------------|--------------------------|
| Balance strictness | Strictly balanced     | Approximately balanced   |
| Max height         | 1.44 log(n+2)        | 2 log(n+1)               |
| Insertions         | Slower (more rotations)| Faster (fewer rotations) |
| Lookups            | Faster (shorter height)| Slightly slower          |
| Rotations/insert   | Up to 2               | Up to 2                  |
| Rotations/delete   | Up to O(log n)        | Up to 3                  |

**Real-world usage:**
- Java: `TreeMap`, `TreeSet`
- C++: `std::map`, `std::set`, `std::multimap`
- Linux kernel: Completely Fair Scheduler (CFS), memory management
- .NET: `SortedDictionary`

---

## BST vs Hash Table

```
Operation        BST (balanced)    Hash Table
──────────────────────────────────────────────────
Search           O(log n)          O(1) avg, O(n) worst
Insert           O(log n)          O(1) avg, O(n) worst
Delete           O(log n)          O(1) avg, O(n) worst
Ordered traversal O(n)             O(n log n) (must sort)
Range query      O(log n + k)      O(n)
Find Min/Max     O(log n)          O(n)
Find successor   O(log n)          O(n)
Space            O(n)              O(n)
```

**Use BST when:** You need ordered data, range queries, predecessor/successor queries, or
rank operations.

**Use Hash Table when:** You only need lookup/insert/delete and order does not matter.

---

## Common Interview Problems

| Problem                               | Key Technique            | Time     |
|---------------------------------------|--------------------------|----------|
| Validate BST                          | Range check / Inorder    | O(n)     |
| Lowest Common Ancestor (BST)          | Path divergence          | O(h)     |
| Kth Smallest Element                  | Inorder traversal        | O(h + k) |
| Inorder Successor                     | Parent pointer or BST    | O(h)     |
| Serialize/Deserialize Binary Tree     | Preorder + null markers  | O(n)     |
| Binary Tree Maximum Path Sum          | Postorder DFS            | O(n)     |
| Symmetric Tree                        | Recursive mirror check   | O(n)     |
| Diameter of Binary Tree               | Postorder DFS            | O(n)     |
| Level Order Zigzag                    | BFS + alternating        | O(n)     |
| Convert Sorted Array to BST           | Recursive mid-split      | O(n)     |
| Flatten Binary Tree to Linked List    | Reverse postorder        | O(n)     |
| Construct from Preorder + Inorder     | Recursive partition      | O(n)     |

---

## Sources

- Cormen, Leiserson, Rivest, Stein. *Introduction to Algorithms* (CLRS), 4th Ed., Ch. 12 "Binary Search Trees", Ch. 13 "Red-Black Trees"
- Sedgewick, R. *Algorithms*, 4th Ed., Ch. 3 "Searching"
- Adelson-Velsky, G.M., Landis, E.M. "An algorithm for the organization of information" (1962), Doklady Akademii Nauk SSSR
- Guibas, L.J., Sedgewick, R. "A Dichromatic Framework for Balanced Trees" (1978), FOCS
- Wikipedia: "Binary search tree", "AVL tree", "Red-black tree", "Tree traversal"
- Skiena, S. *The Algorithm Design Manual*, Ch. 3 "Data Structures"
