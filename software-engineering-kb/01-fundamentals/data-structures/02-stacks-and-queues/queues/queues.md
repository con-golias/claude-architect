# Queues

> **Domain:** Fundamentals > Data Structures > Stacks and Queues
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

A queue is a linear data structure that follows the **FIFO (First In, First Out)** principle. The first element added is the first one removed — like a line at a checkout counter.

The two primary operations are:
- **Enqueue** — add an element to the back (rear/tail).
- **Dequeue** — remove and return the element from the front (head).

## Why It Matters

- **Task scheduling** — CPU schedulers, print queues, message queues all use FIFO ordering.
- **BFS traversal** — breadth-first search on graphs and trees requires a queue.
- **Buffering** — network packets, I/O operations, event handling.
- **Fairness** — first-come, first-served processing guarantees order.

## How It Works

### Visual Model

```
Enqueue A, B, C:              Dequeue:

front                rear     front              rear
  ↓                    ↓        ↓                  ↓
┌───┬───┬───┐              ┌───┬───┐
│ A │ B │ C │         A ←  │ B │ C │
└───┴───┴───┘       removed└───┴───┘
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Enqueue | O(1) | Add to rear |
| Dequeue | O(1) | Remove from front |
| Peek/Front | O(1) | View front element |
| IsEmpty | O(1) | Check if empty |
| Search | O(n) | Linear scan |

### Implementation

```typescript
// Array-based queue (simple but O(n) dequeue due to shift)
// For production, use a circular buffer or linked list

// Linked list-based queue — O(1) for both operations
class Queue<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private count: number = 0;

  enqueue(data: T): void {
    const node = new ListNode(data);
    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this.count++;
  }

  dequeue(): T | undefined {
    if (!this.head) return undefined;
    const data = this.head.data;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.count--;
    return data;
  }

  peek(): T | undefined {
    return this.head?.data;
  }

  get size(): number {
    return this.count;
  }
}
```

```python
from collections import deque

# Python — use deque for O(1) operations at both ends
queue = deque()
queue.append("A")       # enqueue
queue.append("B")
queue.append("C")
front = queue.popleft()  # dequeue → "A"
peek = queue[0]          # peek → "B"
```

```java
// Java — use LinkedList or ArrayDeque as Queue
Queue<String> queue = new LinkedList<>();
queue.offer("A");        // enqueue
queue.offer("B");
String front = queue.poll();  // dequeue → "A"
String peek = queue.peek();   // peek → "B"
```

### BFS with a Queue

```python
from collections import deque

def bfs(graph: dict, start: str) -> list[str]:
    visited = set()
    queue = deque([start])
    visited.add(start)
    result = []

    while queue:
        node = queue.popleft()
        result.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return result
```

## Best Practices

1. **Never use `array.shift()` in JavaScript for a queue** — it's O(n). Use a linked list or circular buffer.
2. **In Python, use `collections.deque`** — not `list` (which is O(n) for `pop(0)`).
3. **In Java, use `LinkedList` or `ArrayDeque`** as Queue implementations.
4. **For concurrent queues**, use thread-safe implementations (`BlockingQueue` in Java, `queue.Queue` in Python).
5. **Consider bounded queues** for backpressure in producer-consumer scenarios.

## Anti-patterns / Common Mistakes

- **Using a list/array with O(n) dequeue** — `list.pop(0)` in Python, `array.shift()` in JS are O(n).
- **Not handling empty queue** — dequeueing from an empty queue should be handled gracefully.
- **Unbounded queues in production** — can cause memory exhaustion; always set a max size for message queues.
- **Busy-waiting on empty queue** — use blocking queues or condition variables for producer-consumer patterns.

## Real-world Examples

- **Message queues** — RabbitMQ, Amazon SQS, Apache Kafka (conceptually).
- **Print spooler** — documents queued in order for printing.
- **Web server request handling** — incoming requests queued for processing.
- **BFS in navigation** — finding shortest path in unweighted graphs.
- **Event loops** — JavaScript's event loop processes callbacks from a task queue.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Python deque (docs.python.org)](https://docs.python.org/3/library/collections.html#collections.deque)
- [ByteByteGo — 4 Types of Queues](https://bytebytego.com/guides/explaining-the-4-most-commonly-used-types-of-queues-in-a-single-diagram/)
