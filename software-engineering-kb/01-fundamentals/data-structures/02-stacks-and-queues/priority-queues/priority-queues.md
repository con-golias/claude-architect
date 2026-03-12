# Priority Queues

> **Domain:** Fundamentals > Data Structures > Stacks and Queues
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A priority queue is an abstract data type where each element has a priority, and elements are dequeued in order of their priority rather than insertion order. The highest-priority element is always removed first. Most implementations use a **binary heap** as the underlying data structure.

## Why It Matters

- **Scheduling** — OS process scheduling, network packet prioritization.
- **Graph algorithms** — Dijkstra's shortest path, Prim's minimum spanning tree both require priority queues.
- **Event-driven simulation** — process events in chronological order.
- **Top-K problems** — efficiently maintain the K largest/smallest elements.

## How It Works

### Min-Heap vs Max-Heap

```
Min-Heap (smallest = highest priority):    Max-Heap (largest = highest priority):
           1                                          9
         /   \                                      /   \
        3     2                                    7     8
       / \   /                                    / \   /
      7   4 5                                    3   4 5
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Insert | O(log n) | Add + bubble up |
| Extract min/max | O(log n) | Remove root + heapify down |
| Peek | O(1) | Return root |
| Build from array | O(n) | Heapify (Floyd's algorithm) |
| Decrease key | O(log n) | Update + bubble up |

### Array-Based Heap Implementation

```
Heap stored as array:
Index:  0   1   2   3   4   5
Value: [1,  3,  2,  7,  4,  5]

Parent of i:       (i - 1) / 2
Left child of i:   2i + 1
Right child of i:  2i + 2
```

```typescript
class MinPriorityQueue<T> {
  private heap: { priority: number; value: T }[] = [];

  insert(value: T, priority: number): void {
    this.heap.push({ priority, value });
    this.bubbleUp(this.heap.length - 1);
  }

  extractMin(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0].value;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }
    return min;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private heapifyDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].priority < this.heap[smallest].priority)
        smallest = left;
      if (right < n && this.heap[right].priority < this.heap[smallest].priority)
        smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
```

### Language Implementations

```python
import heapq

# Python — heapq (min-heap)
heap = []
heapq.heappush(heap, (3, "low"))
heapq.heappush(heap, (1, "high"))
heapq.heappush(heap, (2, "medium"))
priority, item = heapq.heappop(heap)  # (1, "high")

# Top-K largest elements
top_3 = heapq.nlargest(3, data)

# For max-heap, negate the priority
heapq.heappush(heap, (-priority, item))
```

```java
// Java — PriorityQueue (min-heap by default)
PriorityQueue<Integer> minHeap = new PriorityQueue<>();
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());

minHeap.offer(3);
minHeap.offer(1);
minHeap.offer(2);
int smallest = minHeap.poll();  // 1

// Custom priority
PriorityQueue<Task> tasks = new PriorityQueue<>(
    Comparator.comparingInt(Task::getPriority)
);
```

### Dijkstra's Algorithm (Classic Use Case)

```python
import heapq

def dijkstra(graph: dict, start: str) -> dict:
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    pq = [(0, start)]  # (distance, node)

    while pq:
        dist, node = heapq.heappop(pq)
        if dist > distances[node]:
            continue  # already found a shorter path
        for neighbor, weight in graph[node]:
            new_dist = dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                heapq.heappush(pq, (new_dist, neighbor))

    return distances
```

## Best Practices

1. **Use a binary heap** for most cases — simple, cache-friendly, and sufficient.
2. **Use library implementations** — `heapq` (Python), `PriorityQueue` (Java), `priority_queue` (C++).
3. **For max-heap in Python, negate priorities** — `heapq` only supports min-heap natively.
4. **Use Fibonacci heaps** only in theory or specialized graph algorithms — binary heaps are faster in practice.
5. **For Top-K problems, use a min-heap of size K** — O(n log K) instead of O(n log n).

## Anti-patterns / Common Mistakes

- **Linear search for min/max** — if you repeatedly need the min or max, use a priority queue, not a sorted array.
- **Assuming sorted iteration** — a heap is not fully sorted; only the root is guaranteed to be min/max.
- **Not using decrease-key** — in Dijkstra's, updating priorities is more efficient than inserting duplicates (though duplicates with lazy deletion also works).
- **Using a priority queue for small collections** — for very small N, a sorted array or linear scan may be faster.

## Real-world Examples

- **Dijkstra's / Prim's algorithms** — shortest paths and minimum spanning trees.
- **OS task scheduling** — higher-priority processes run first.
- **Hospital ER triage** — patients seen by severity, not arrival order.
- **Huffman coding** — building optimal prefix codes for compression.
- **Event simulation** — events processed in chronological order.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Python heapq (docs.python.org)](https://docs.python.org/3/library/heapq.html)
