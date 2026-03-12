# Circular Linked Lists

> **Domain:** Fundamentals > Data Structures > Arrays and Lists > Linked Lists
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A circular linked list is a linked list where the last node points back to the first node instead of `null`, forming a cycle. It can be singly circular (last→first) or doubly circular (last→first and first→last). There is no natural "end" — traversal continues indefinitely unless explicitly stopped.

## Why It Matters

- **Continuous cycling** — perfect for round-robin scheduling and circular buffers.
- **No null checks for "end of list"** — traversal wraps around naturally.
- **Efficient for circular data** — playlists, turn-based games, CPU scheduling.
- **Can be implemented with just a tail pointer** — head is simply `tail.next`.

## How It Works

### Structure

```
Singly Circular:
┌───┬───┐    ┌───┬───┐    ┌───┬───┐
│ A │ ──┼───→│ B │ ──┼───→│ C │ ──┼──┐
└───┴───┘    └───┴───┘    └───┴───┘  │
  ↑                                   │
  └───────────────────────────────────┘

Doubly Circular:
  ┌──────────────────────────────────────┐
  │  ┌───┬───┬───┐  ┌───┬───┬───┐  ┌───┬───┬───┐
  └─→│ ← │ A │ → ├─→│ ← │ B │ → ├─→│ ← │ C │ → ├─┐
     └───┴───┴───┘  └───┴───┴───┘  └───┴───┴───┘  │
       ↑                                            │
       └────────────────────────────────────────────┘
```

### Implementation

```typescript
class CircularLinkedList<T> {
  private tail: ListNode<T> | null = null;
  private size: number = 0;

  // O(1) — insert at front (after tail, becoming new "head")
  insertAtHead(data: T): void {
    const node = new ListNode(data);
    if (!this.tail) {
      node.next = node;  // points to itself
      this.tail = node;
    } else {
      node.next = this.tail.next;  // node → old head
      this.tail.next = node;       // tail → node
    }
    this.size++;
  }

  // O(1) — insert at end (new tail)
  insertAtTail(data: T): void {
    this.insertAtHead(data);
    this.tail = this.tail!.next;  // advance tail to new node
  }

  // O(n) — traverse the entire list
  traverse(callback: (data: T) => void): void {
    if (!this.tail) return;
    let current = this.tail.next;  // start at head
    do {
      callback(current!.data);
      current = current!.next;
    } while (current !== this.tail.next);
  }
}
```

### Josephus Problem (Classic Application)

The Josephus problem is a classic use case: n people in a circle, every k-th person is eliminated until one remains.

```python
def josephus(n: int, k: int) -> int:
    # Build circular linked list
    head = ListNode(0)
    current = head
    for i in range(1, n):
        current.next = ListNode(i)
        current = current.next
    current.next = head  # close the circle

    # Eliminate every k-th person
    while current.next != current:
        for _ in range(k - 1):
            current = current.next
        current.next = current.next.next  # remove k-th
    return current.data  # survivor
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert at head | O(1) | With tail pointer |
| Insert at tail | O(1) | With tail pointer |
| Delete head | O(1) | Update tail.next |
| Delete by value | O(n) | Must search |
| Search | O(n) | Traverse until back at start |
| Cycle detection | O(1) | Inherent — it IS a cycle |

## Best Practices

1. **Use a tail pointer** instead of head — gives O(1) access to both head (`tail.next`) and tail.
2. **Always check for single-node case** — a single node points to itself.
3. **Use a counter or sentinel** to know when you've completed a full traversal.
4. **Prefer standard library circular buffers** for production use (e.g., ring buffers).

## Anti-patterns / Common Mistakes

- **Infinite loops** — forgetting to track where traversal started.
- **Off-by-one errors** — confusing head and tail in circular structure.
- **Not handling single-element deletion** — removing the only node must set tail to null.
- **Using circular lists when a simple modulo on an array index would suffice.**

## Real-world Examples

- **Round-robin scheduling** — CPU task scheduler cycles through processes.
- **Music playlist loop** — continuous playback wrapping from last to first song.
- **Circular buffers/ring buffers** — network I/O, audio streaming.
- **Token ring networks** — network packets travel in a circle.
- **Turn-based games** — cycling through players continuously.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [GeeksforGeeks — Circular Linked List](https://www.geeksforgeeks.org/circular-linked-list/)
- [Wikipedia — Linked List](https://en.wikipedia.org/wiki/Linked_list)
