# Static Arrays

> **Domain:** Fundamentals > Data Structures > Arrays and Lists
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

A static array is a fixed-size, contiguous block of memory that stores elements of the same type. The size is determined at creation time and cannot change. Elements are accessed directly by their index in O(1) time because the memory address of any element can be calculated from the base address plus the index multiplied by the element size.

## Why It Matters

- **Fastest random access** of any data structure — O(1) by index.
- **Cache-friendly** — contiguous memory layout means CPU cache lines load adjacent elements automatically.
- **Predictable memory usage** — no overhead from pointers or dynamic resizing.
- **Foundation** for nearly every other data structure (dynamic arrays, heaps, hash tables all use arrays internally).

## How It Works

### Memory Layout

```
Index:    0     1     2     3     4
        ┌─────┬─────┬─────┬─────┬─────┐
Memory: │  10 │  20 │  30 │  40 │  50 │
        └─────┴─────┴─────┴─────┴─────┘
Address: 0x100 0x104 0x108 0x10C 0x110  (4 bytes per int)

Address of element[i] = base_address + (i × element_size)
```

### Operations and Time Complexity

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| Access by index | O(1) | Direct address calculation |
| Search (unsorted) | O(n) | Must scan linearly |
| Search (sorted) | O(log n) | Binary search |
| Insert at end | O(1) | If space available |
| Insert at position | O(n) | Must shift elements right |
| Delete at position | O(n) | Must shift elements left |

### Language Implementations

```c
// C — true static array
int scores[5] = {90, 85, 92, 78, 95};
int third = scores[2];  // O(1) access → 92
```

```java
// Java — fixed-size array
int[] scores = new int[5];
scores[0] = 90;
// scores[5] = 100;  // ArrayIndexOutOfBoundsException
```

```python
# Python — array module for typed fixed-size arrays
from array import array
scores = array('i', [90, 85, 92, 78, 95])  # 'i' = signed int
```

```typescript
// TypeScript — typed arrays for fixed-size numeric arrays
const buffer = new ArrayBuffer(20);  // 20 bytes
const scores = new Int32Array(buffer);  // 5 × 4-byte integers
scores[0] = 90;
```

### Multi-Dimensional Arrays

```
2D Array (3×4 matrix):
        Col 0  Col 1  Col 2  Col 3
Row 0: [  1  |  2  |  3  |  4  ]
Row 1: [  5  |  6  |  7  |  8  ]
Row 2: [  9  | 10  | 11  | 12  ]

Row-major (C, Java): [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
Col-major (Fortran):  [1, 5, 9, 2, 6, 10, 3, 7, 11, 4, 8, 12]

Address of element[row][col] = base + (row × num_cols + col) × size
```

## Best Practices

1. **Use when size is known at compile time** — avoid dynamic allocation overhead.
2. **Prefer over linked lists for iteration** — cache locality gives 10-100x speedup.
3. **Use typed arrays for numeric data** — `Int32Array`, `Float64Array` in JS/TS.
4. **Check bounds** — buffer overflows from out-of-bounds access are a top security vulnerability (C/C++).
5. **Consider alignment** — struct arrays may have padding; use packed structs only when necessary.

## Anti-patterns / Common Mistakes

- **Magic indices** — using raw numbers like `data[3]` without explaining what index 3 means.
- **Buffer overflows** — accessing beyond array bounds in C/C++ causes undefined behavior and security vulnerabilities.
- **Using arrays when size varies** — if the size changes frequently, use a dynamic array instead.
- **Ignoring cache effects** — iterating column-first over a row-major 2D array causes cache misses.

## Real-world Examples

- **Image pixels** — a 1920×1080 image is a 2D array of pixel values.
- **Lookup tables** — pre-computed sin/cos values for game engines.
- **Buffers** — network packets, file I/O buffers, audio sample buffers.
- **Embedded systems** — fixed-size arrays are standard where dynamic allocation is unavailable.

## Sources

- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [GeeksforGeeks — Array Data Structure](https://www.geeksforgeeks.org/array-data-structure/)
- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
