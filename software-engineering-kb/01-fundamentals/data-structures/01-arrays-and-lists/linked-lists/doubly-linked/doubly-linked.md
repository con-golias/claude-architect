# Doubly Linked Lists

> **Domain:** Fundamentals > Data Structures > Arrays and Lists > Linked Lists
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A doubly linked list is a linked list where each node has two pointers: one to the next node and one to the previous node. This enables O(1) traversal in both directions and O(1) deletion of a node when you have a direct reference to it — something singly linked lists cannot do.

## Why It Matters

- **Bidirectional traversal** — can move forward and backward through the list.
- **O(1) deletion with a reference** — no need to traverse to find the previous node.
- **Foundation for LRU caches** — the classic LRU cache combines a doubly linked list with a hash map.
- **Used in standard libraries** — Java's `LinkedList`, C++'s `std::list`, Python's `collections.deque`.

## How It Works

### Structure

```
null ←──┐                                         ┌──→ null
        │                                         │
      ┌─┴──┬───┬───┐    ┌───┬───┬───┐    ┌───┬───┬─┴─┐
      │prev│ A │next┼───→│prev│ B │next┼───→│prev│ C │next│
      └────┴───┴───┘    └───┴───┴───┘    └───┴───┴───┘
             ↑            ↑         │            ↑
            head          └─────────┘           tail
                       (B.prev = A)
```

### Node Definition

```typescript
class DoublyLinkedNode<T> {
  data: T;
  prev: DoublyLinkedNode<T> | null;
  next: DoublyLinkedNode<T> | null;

  constructor(data: T) {
    this.data = data;
    this.prev = null;
    this.next = null;
  }
}
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert at head | O(1) | Update head and previous pointers |
| Insert at tail | O(1) | With tail pointer |
| Delete node (with reference) | O(1) | Update prev.next and next.prev |
| Delete by value | O(n) | Must search first |
| Search | O(n) | Traverse from either end |
| Reverse traversal | O(n) | Follow prev pointers from tail |

### Core Operations

```typescript
class DoublyLinkedList<T> {
  private head: DoublyLinkedNode<T> | null = null;
  private tail: DoublyLinkedNode<T> | null = null;
  private size: number = 0;

  // O(1) — add to front
  insertAtHead(data: T): DoublyLinkedNode<T> {
    const node = new DoublyLinkedNode(data);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    this.size++;
    return node;
  }

  // O(1) — add to back
  insertAtTail(data: T): DoublyLinkedNode<T> {
    const node = new DoublyLinkedNode(data);
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
    return node;
  }

  // O(1) — delete any node by reference
  deleteNode(node: DoublyLinkedNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    this.size--;
  }

  // O(1) — move existing node to head (used in LRU cache)
  moveToHead(node: DoublyLinkedNode<T>): void {
    this.deleteNode(node);
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.size++;
  }
}
```

### LRU Cache (Classic Interview Problem)

The most famous use of doubly linked lists — combining with a hash map for O(1) get/put:

```python
class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}                 # key → node
        self.head = Node(0, 0)          # dummy head
        self.tail = Node(0, 0)          # dummy tail
        self.head.next = self.tail
        self.tail.prev = self.head

    def get(self, key: int) -> int:     # O(1)
        if key in self.cache:
            node = self.cache[key]
            self._move_to_front(node)
            return node.value
        return -1

    def put(self, key: int, value: int) -> None:  # O(1)
        if key in self.cache:
            self.cache[key].value = value
            self._move_to_front(self.cache[key])
        else:
            node = Node(key, value)
            self.cache[key] = node
            self._add_to_front(node)
            if len(self.cache) > self.capacity:
                lru = self.tail.prev
                self._remove(lru)
                del self.cache[lru.key]
```

## Best Practices

1. **Use sentinel (dummy) head and tail nodes** — eliminates all null-check edge cases.
2. **Store node references in a hash map** for O(1) lookup + O(1) deletion.
3. **Prefer standard library implementations** — `LinkedList` (Java), `std::list` (C++), `deque` (Python).
4. **Use doubly linked lists only when you need bidirectional traversal or O(1) arbitrary deletion** — otherwise arrays are faster.

## Anti-patterns / Common Mistakes

- **Extra memory overhead** — two pointers per node (16 bytes on 64-bit) compared to one for singly linked.
- **Using when arrays suffice** — for simple sequential access, arrays are faster due to cache locality.
- **Forgetting to update both pointers** — every insertion/deletion must update both `prev` and `next`.
- **Not using sentinel nodes** — leads to complex edge-case handling for empty list, single element, etc.

## Real-world Examples

- **LRU Cache** — operating systems, databases, CDNs, browser caches.
- **Browser history** — back/forward navigation with prev/next pointers.
- **Text editors** — cursor movement and undo/redo operations.
- **Thread schedulers** — OS schedulers use doubly linked lists for process queues.
- **Java's `LinkedList`** — implements both `List` and `Deque` interfaces using a doubly linked list.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [GeeksforGeeks — Doubly Linked List](https://www.geeksforgeeks.org/doubly-linked-list/)
- [LeetCode — LRU Cache (Problem 146)](https://leetcode.com/problems/lru-cache/)
