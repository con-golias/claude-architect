# Circular Buffers (Ring Buffers)

> **Domain:** Fundamentals > Data Structures > Stacks and Queues
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A circular buffer (ring buffer) is a fixed-size buffer that wraps around — when the write pointer reaches the end, it loops back to the beginning. It provides O(1) enqueue and dequeue without any shifting or reallocation, making it ideal for streaming data, I/O buffering, and producer-consumer scenarios.

## Why It Matters

- **Zero-allocation streaming** — fixed memory, no garbage collection pauses.
- **Lock-free implementations** — single-producer/single-consumer ring buffers can be lock-free.
- **Real-time systems** — predictable O(1) performance with no resizing.
- **Hardware alignment** — used in kernel buffers, network cards, audio drivers.

## How It Works

### Visual Model

```
Fixed buffer of size 8:

Write pointer (W) and Read pointer (R):

    R           W
    ↓           ↓
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │ D │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
  0   1   2   3   4   5   6   7

After wrapping:
        W   R
        ↓   ↓
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ H │ I │   │ D │ E │ F │ G │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
  0   1   2   3   4   5   6   7
```

### Operations and Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Enqueue | O(1) | Write at tail, advance pointer |
| Dequeue | O(1) | Read at head, advance pointer |
| Peek | O(1) | Read without advancing |
| IsFull | O(1) | Compare pointers |
| IsEmpty | O(1) | Compare pointers |

### Implementation

```typescript
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;     // read pointer
  private tail: number = 0;     // write pointer
  private count: number = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  enqueue(item: T): boolean {
    if (this.isFull()) return false;  // or overwrite oldest
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  dequeue(): T | undefined {
    if (this.isEmpty()) return undefined;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }

  // Overwriting variant — always writes, drops oldest if full
  enqueueOverwrite(item: T): void {
    if (this.isFull()) {
      this.head = (this.head + 1) % this.capacity;  // drop oldest
      this.count--;
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
  }

  isFull(): boolean { return this.count === this.capacity; }
  isEmpty(): boolean { return this.count === 0; }
  get size(): number { return this.count; }
}
```

```c
// C — lock-free SPSC ring buffer (single producer, single consumer)
typedef struct {
    int* buffer;
    int capacity;
    volatile int head;  // consumer reads here
    volatile int tail;  // producer writes here
} RingBuffer;

int rb_enqueue(RingBuffer* rb, int item) {
    int next_tail = (rb->tail + 1) % rb->capacity;
    if (next_tail == rb->head) return -1;  // full
    rb->buffer[rb->tail] = item;
    rb->tail = next_tail;  // atomic on most architectures
    return 0;
}

int rb_dequeue(RingBuffer* rb, int* item) {
    if (rb->head == rb->tail) return -1;  // empty
    *item = rb->buffer[rb->head];
    rb->head = (rb->head + 1) % rb->capacity;
    return 0;
}
```

### Two Design Choices

**1. Block when full** — producer waits until consumer reads (bounded queue).
**2. Overwrite oldest** — new data always writes, old data is dropped (logging, telemetry).

```python
from collections import deque

# Python — bounded deque acts as an overwriting ring buffer
recent_logs = deque(maxlen=1000)
recent_logs.append("log entry 1")
recent_logs.append("log entry 2")
# After 1000 entries, oldest are automatically dropped
```

## Best Practices

1. **Use power-of-2 capacity** — allows bitwise AND instead of modulo for wrapping (`index & (capacity - 1)`).
2. **Choose block vs overwrite semantics** based on your use case.
3. **For SPSC (single-producer/single-consumer)**, you can avoid locks entirely with memory barriers.
4. **Pre-allocate the buffer** — the whole point is zero allocation during operation.
5. **Use standard library** implementations when available (`deque(maxlen=n)` in Python).

## Anti-patterns / Common Mistakes

- **Off-by-one in full detection** — a ring buffer with N slots can hold at most N-1 items (one slot distinguishes full from empty), or use a separate count.
- **Using modulo with non-power-of-2 sizes** — modulo is slower than bitwise AND.
- **Multi-producer/multi-consumer without synchronization** — only SPSC is naturally lock-free.
- **Not handling the wrap-around** — forgetting the modulo/AND when advancing pointers.

## Real-world Examples

- **Audio processing** — audio samples buffered between capture and playback threads.
- **Network drivers** — NIC ring buffers for incoming/outgoing packets.
- **Logging** — keep the last N log entries without unbounded memory growth.
- **Linux kernel** — `kfifo` is a ring buffer used throughout the kernel.
- **LMAX Disruptor** — high-performance inter-thread messaging using a ring buffer (millions of ops/sec).

## Sources

- [Wikipedia — Circular Buffer](https://en.wikipedia.org/wiki/Circular_buffer)
- [Embedded Artistry — Creating a Circular Buffer in C](https://embeddedartistry.com/blog/2017/05/17/creating-a-circular-buffer-in-c-and-c/)
- [LMAX Disruptor](https://lmax-exchange.github.io/disruptor/)
