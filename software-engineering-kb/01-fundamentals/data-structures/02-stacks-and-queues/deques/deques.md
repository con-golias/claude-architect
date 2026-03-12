# Deques (Double-Ended Queues)

> **Domain:** Fundamentals > Data Structures > Stacks and Queues
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A deque (pronounced "deck") is a double-ended queue that supports O(1) insertion and removal at **both** ends. It combines the capabilities of both stacks and queues — you can use it as either, or both simultaneously.

## Why It Matters

- **Most versatile linear structure** — replaces stacks, queues, and their combinations.
- **Standard library default** — Python's `deque`, Java's `ArrayDeque`, C++'s `std::deque`.
- **Sliding window problems** — the monotonic deque is a key algorithmic pattern.
- **Work-stealing algorithms** — concurrent deques are used in modern thread pools (Java's ForkJoinPool).

## How It Works

### Visual Model

```
       addFirst      addLast
          ↓              ↓
        ┌───┬───┬───┬───┬───┐
Front ← │ A │ B │ C │ D │ E │ → Rear
        └───┴───┴───┴───┴───┘
          ↑              ↑
      removeFirst    removeLast
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Add to front | O(1) | Push front |
| Add to rear | O(1) | Push back |
| Remove from front | O(1) | Pop front |
| Remove from rear | O(1) | Pop back |
| Peek front/rear | O(1) | No removal |
| Search | O(n) | Linear scan |

### Implementation (Circular Buffer)

Most deque implementations use a circular buffer (ring buffer) internally:

```typescript
class Deque<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;

  constructor(capacity: number = 16) {
    this.buffer = new Array(capacity);
  }

  addFirst(item: T): void {
    if (this.count === this.buffer.length) this.resize();
    this.head = (this.head - 1 + this.buffer.length) % this.buffer.length;
    this.buffer[this.head] = item;
    this.count++;
  }

  addLast(item: T): void {
    if (this.count === this.buffer.length) this.resize();
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.buffer.length;
    this.count++;
  }

  removeFirst(): T | undefined {
    if (this.count === 0) return undefined;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.buffer.length;
    this.count--;
    return item;
  }

  removeLast(): T | undefined {
    if (this.count === 0) return undefined;
    this.tail = (this.tail - 1 + this.buffer.length) % this.buffer.length;
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.count--;
    return item;
  }

  private resize(): void {
    const newBuffer = new Array(this.buffer.length * 2);
    for (let i = 0; i < this.count; i++) {
      newBuffer[i] = this.buffer[(this.head + i) % this.buffer.length];
    }
    this.buffer = newBuffer;
    this.head = 0;
    this.tail = this.count;
  }
}
```

### Language Implementations

```python
from collections import deque

d = deque()
d.appendleft("A")   # add to front
d.append("B")       # add to rear
d.popleft()          # remove from front → "A"
d.pop()              # remove from rear → "B"

# Bounded deque (automatically drops oldest)
recent = deque(maxlen=5)
for i in range(10):
    recent.append(i)
# recent = deque([5, 6, 7, 8, 9])
```

```java
Deque<String> deque = new ArrayDeque<>();
deque.addFirst("A");     // front
deque.addLast("B");      // rear
deque.removeFirst();     // "A"
deque.removeLast();      // "B"

// Use as stack:
deque.push("X");         // addFirst
deque.pop();             // removeFirst

// Use as queue:
deque.offer("Y");        // addLast
deque.poll();            // removeFirst
```

### Sliding Window Maximum (Monotonic Deque)

Classic O(n) algorithm using a deque:

```python
from collections import deque

def max_sliding_window(nums: list[int], k: int) -> list[int]:
    result = []
    dq = deque()  # stores indices of useful elements

    for i, num in enumerate(nums):
        # Remove elements outside the window
        while dq and dq[0] < i - k + 1:
            dq.popleft()
        # Remove smaller elements (they'll never be the max)
        while dq and nums[dq[-1]] < num:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            result.append(nums[dq[0]])
    return result
```

## Best Practices

1. **Default to deque over stack/queue** — it handles both patterns with the same performance.
2. **Use bounded deques for recent-history tracking** — Python's `deque(maxlen=n)`.
3. **Prefer `ArrayDeque` in Java** — faster than `LinkedList` for deque operations.
4. **Use monotonic deques** for sliding window min/max problems — O(n) vs O(n log n).

## Anti-patterns / Common Mistakes

- **Random access on deques** — some implementations support indexing, but it may not be O(1).
- **Using `LinkedList` as a deque in Java** — `ArrayDeque` is faster due to cache locality.
- **Not leveraging bounded deques** — for rolling windows, use `maxlen` instead of manual trimming.

## Real-world Examples

- **Work stealing** — Java's ForkJoinPool uses concurrent deques for task distribution.
- **Undo/Redo** — push operations on one end, undo pops from the same end, redo from the other.
- **Palindrome checking** — compare characters from both ends simultaneously.
- **Sliding window analytics** — track moving averages, max/min over recent events.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Python deque (docs.python.org)](https://docs.python.org/3/library/collections.html#collections.deque)
- [Java ArrayDeque (Oracle)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html)
