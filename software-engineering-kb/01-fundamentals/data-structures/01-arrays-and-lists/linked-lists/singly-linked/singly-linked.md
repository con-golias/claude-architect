# Singly Linked Lists

> **Domain:** Fundamentals > Data Structures > Arrays and Lists > Linked Lists
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

A singly linked list is a linear data structure where each element (node) contains a value and a pointer to the next node. The last node points to `null`. Unlike arrays, elements are not stored contiguously in memory — each node can be anywhere in the heap, connected only by pointers.

## Why It Matters

- **O(1) insertion/deletion at the head** — no shifting required.
- **Dynamic size** — grows and shrinks without reallocation or copying.
- **No wasted space** — uses exactly as much memory as needed (plus pointer overhead).
- **Foundation** for stacks, queues, and more complex structures (adjacency lists, hash chain buckets).

## How It Works

### Structure

```
head
 ↓
┌───┬───┐    ┌───┬───┐    ┌───┬───┐    ┌───┬──────┐
│ A │ ──┼───→│ B │ ──┼───→│ C │ ──┼───→│ D │ null │
└───┴───┘    └───┴───┘    └───┴───┘    └───┴──────┘
 data next    data next    data next    data  next
```

### Node Definition

```typescript
class ListNode<T> {
  data: T;
  next: ListNode<T> | null;

  constructor(data: T) {
    this.data = data;
    this.next = null;
  }
}
```

```python
class ListNode:
    def __init__(self, data):
        self.data = data
        self.next = None
```

```java
class ListNode<T> {
    T data;
    ListNode<T> next;

    ListNode(T data) {
        this.data = data;
        this.next = null;
    }
}
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert at head | O(1) | Update head pointer |
| Insert at tail | O(n) | Must traverse to end (O(1) with tail pointer) |
| Delete at head | O(1) | Update head pointer |
| Delete by value | O(n) | Must find the node first |
| Search | O(n) | Linear traversal |
| Access by index | O(n) | Must traverse from head |

### Core Operations

```typescript
class SinglyLinkedList<T> {
  private head: ListNode<T> | null = null;

  // O(1) — prepend to front
  insertAtHead(data: T): void {
    const node = new ListNode(data);
    node.next = this.head;
    this.head = node;
  }

  // O(n) — remove first occurrence
  delete(data: T): boolean {
    if (!this.head) return false;
    if (this.head.data === data) {
      this.head = this.head.next;
      return true;
    }
    let current = this.head;
    while (current.next) {
      if (current.next.data === data) {
        current.next = current.next.next;
        return true;
      }
      current = current.next;
    }
    return false;
  }

  // O(n) — linear search
  find(data: T): ListNode<T> | null {
    let current = this.head;
    while (current) {
      if (current.data === data) return current;
      current = current.next;
    }
    return null;
  }
}
```

### Sentinel (Dummy) Node Pattern

Using a dummy head node simplifies insertion/deletion logic by eliminating edge cases:

```python
class SinglyLinkedList:
    def __init__(self):
        self.dummy = ListNode(None)  # sentinel node

    def insert_after(self, prev_node, data):
        new_node = ListNode(data)
        new_node.next = prev_node.next
        prev_node.next = new_node
        # No special case needed for empty list
```

## Best Practices

1. **Use a sentinel/dummy node** — eliminates null checks for empty list edge cases.
2. **Maintain a tail pointer** if you need O(1) append.
3. **Use the two-pointer technique** — fast/slow pointers for cycle detection, finding middle, etc.
4. **Prefer arrays for random access** — linked lists are O(n) for indexing.
5. **Consider memory overhead** — each node has a pointer (8 bytes on 64-bit), which can be significant for small data.

## Anti-patterns / Common Mistakes

- **Using linked lists when arrays suffice** — arrays are faster for iteration due to cache locality.
- **Not handling edge cases** — empty list, single element, head/tail operations.
- **Memory leaks** — in languages without GC, forgetting to free deleted nodes.
- **Losing the head pointer** — always keep a reference to head; losing it means losing the entire list.

## Real-world Examples

- **Hash table chaining** — each bucket is a linked list of colliding entries.
- **Undo history** — simple stack-like undo with O(1) push/pop at head.
- **Memory allocators** — free lists track available memory blocks.
- **Polynomial representation** — each term stored as a node with coefficient and exponent.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [GeeksforGeeks — Types of Linked List](https://www.geeksforgeeks.org/types-of-linked-list/)
- [Wikipedia — Linked List](https://en.wikipedia.org/wiki/Linked_list)
