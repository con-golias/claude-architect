# Binary Search Trees (BST)

> **Domain:** Fundamentals > Data Structures > Trees
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A Binary Search Tree (BST) is a binary tree with an ordering invariant: for every node, all values in its left subtree are **less than** the node's value, and all values in its right subtree are **greater than** the node's value. This property enables O(log n) search, insert, and delete operations on balanced trees.

## Why It Matters

- **O(log n) search** — much faster than O(n) linear search in unsorted data.
- **Sorted iteration** — inorder traversal yields elements in sorted order.
- **Dynamic sorted data** — unlike sorted arrays, BSTs support O(log n) insertion and deletion.
- **Foundation** for self-balancing trees (AVL, Red-Black), used in maps, sets, and databases.

## How It Works

### BST Property

```
         8          For every node X:
        / \         - All nodes in left subtree < X
       3   10       - All nodes in right subtree > X
      / \    \
     1   6    14    Inorder traversal: 1, 3, 4, 6, 7, 8, 10, 14
        / \   /
       4   7 13    (sorted!)
```

### Operations and Time Complexity

| Operation | Average (balanced) | Worst (degenerate) |
|-----------|-------------------|-------------------|
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |
| Min/Max | O(log n) | O(n) |
| Inorder traversal | O(n) | O(n) |

### Implementation

```typescript
class BST<T> {
  private root: TreeNode<T> | null = null;

  // O(log n) average — search
  search(value: T): TreeNode<T> | null {
    let current = this.root;
    while (current) {
      if (value === current.data) return current;
      if (value < current.data) current = current.left;
      else current = current.right;
    }
    return null;
  }

  // O(log n) average — insert
  insert(value: T): void {
    this.root = this.insertNode(this.root, value);
  }

  private insertNode(node: TreeNode<T> | null, value: T): TreeNode<T> {
    if (!node) return new TreeNode(value);
    if (value < node.data) node.left = this.insertNode(node.left, value);
    else if (value > node.data) node.right = this.insertNode(node.right, value);
    return node;  // duplicate — no-op
  }

  // O(log n) average — delete
  delete(value: T): void {
    this.root = this.deleteNode(this.root, value);
  }

  private deleteNode(node: TreeNode<T> | null, value: T): TreeNode<T> | null {
    if (!node) return null;

    if (value < node.data) {
      node.left = this.deleteNode(node.left, value);
    } else if (value > node.data) {
      node.right = this.deleteNode(node.right, value);
    } else {
      // Found the node to delete
      if (!node.left) return node.right;   // Case 1: no left child
      if (!node.right) return node.left;   // Case 2: no right child

      // Case 3: two children — replace with inorder successor
      let successor = node.right;
      while (successor.left) successor = successor.left;
      node.data = successor.data;
      node.right = this.deleteNode(node.right, successor.data);
    }
    return node;
  }

  // O(log n) average — find minimum
  min(): T | undefined {
    let current = this.root;
    while (current?.left) current = current.left;
    return current?.data;
  }

  // O(n) — inorder traversal (sorted output)
  inorder(): T[] {
    const result: T[] = [];
    this.inorderHelper(this.root, result);
    return result;
  }

  private inorderHelper(node: TreeNode<T> | null, result: T[]): void {
    if (!node) return;
    this.inorderHelper(node.left, result);
    result.push(node.data);
    this.inorderHelper(node.right, result);
  }
}
```

### Deletion Cases

```
Case 1: Leaf node — just remove it
Case 2: One child — replace node with its child
Case 3: Two children — replace with inorder successor (smallest in right subtree)

Delete 3 (two children):
     8                  8
    / \                / \
   3   10    →        4   10
  / \    \           / \    \
 1   6    14        1   6    14
    / \                / \
   4   7              5   7
    \
     5
   (successor = 4)
```

### The Degenerate Case Problem

```
Insert sorted data: 1, 2, 3, 4, 5

     1
      \
       2           Height = n - 1
        \          All operations become O(n)
         3         This is why self-balancing
          \        trees (AVL, Red-Black) exist
           4
            \
             5
```

## Best Practices

1. **Use self-balancing variants** (AVL, Red-Black) for production code — plain BSTs can degenerate.
2. **Randomize insertion order** if using a plain BST — reduces likelihood of degenerate case.
3. **Use inorder traversal** when you need sorted output — it's the natural sorted iteration.
4. **Use standard library implementations** — `TreeMap`/`TreeSet` (Java), `std::set`/`std::map` (C++).

## Anti-patterns / Common Mistakes

- **Inserting sorted data into a plain BST** — creates a linked list with O(n) operations.
- **Not handling all three deletion cases** — especially the two-children case.
- **Confusing BST with binary tree** — not all binary trees maintain the BST ordering property.
- **Building a BST when a hash table suffices** — if you only need lookup, hash tables are O(1) average.

## Real-world Examples

- **Database indexes** — B-trees (generalized BSTs) power database index lookups.
- **Java's `TreeMap`/`TreeSet`** — Red-Black tree implementation providing sorted operations.
- **C++ `std::map`/`std::set`** — Red-Black tree in most standard library implementations.
- **File system directory ordering** — directories often stored in BST-like structures.
- **Autocomplete** — BSTs can support prefix-based search (though tries are more specialized).

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [GeeksforGeeks — Binary Search Tree](https://www.geeksforgeeks.org/binary-search-tree-data-structure/)
