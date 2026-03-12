# Dynamic Arrays

> **Domain:** Fundamentals > Data Structures > Arrays and Lists
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

A dynamic array is a resizable array that automatically grows (and sometimes shrinks) as elements are added or removed. It wraps a static array internally and allocates a larger array when the current one fills up, copying elements over. This gives O(1) amortized append time while maintaining O(1) random access.

## Why It Matters

- **Most-used data structure** in application programming — Python's `list`, Java's `ArrayList`, C++'s `std::vector`, JavaScript's `Array`.
- **Best of both worlds** — O(1) random access like static arrays, plus dynamic resizing.
- **Cache-friendly** — still contiguous memory, unlike linked lists.
- **Foundation** for stacks, queues, heaps, and hash tables in most standard libraries.

## How It Works

### Growth Strategy

When the array is full and a new element is added:

```
Step 1: Array is full (capacity = 4, size = 4)
┌───┬───┬───┬───┐
│ A │ B │ C │ D │
└───┴───┴───┴───┘

Step 2: Allocate new array with 2× capacity
┌───┬───┬───┬───┬───┬───┬───┬───┐
│   │   │   │   │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘

Step 3: Copy elements + add new element
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │ D │ E │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
                    ↑ new element

Growth factor is typically 1.5× (Java, C#) or 2× (Python, C++)
```

### Amortized Analysis

Individual resizes are O(n), but they happen infrequently:

```
Operations:  1   2   3   4   5   6   7   8   9  ...
Cost:        1   1   1   3   1   1   1   5   1  ...
                         ↑               ↑
                    copy 2+add       copy 4+add

Total cost for n operations ≈ 3n → amortized O(1) per append
```

### Operations and Time Complexity

| Operation | Average | Worst | Notes |
|-----------|---------|-------|-------|
| Access by index | O(1) | O(1) | Direct calculation |
| Append (push_back) | O(1)* | O(n) | Amortized O(1) |
| Insert at index | O(n) | O(n) | Shift elements right |
| Delete at index | O(n) | O(n) | Shift elements left |
| Delete last (pop) | O(1) | O(1) | No shifting needed |
| Search | O(n) | O(n) | Linear scan |

### Language Implementations

```python
# Python — list (dynamic array)
items = []
items.append("a")       # O(1) amortized
items.append("b")
items[0]                 # O(1) access → "a"
items.insert(1, "x")    # O(n) — shifts elements
items.pop()              # O(1) — remove last
items.pop(0)             # O(n) — shifts all elements
```

```java
// Java — ArrayList
ArrayList<String> items = new ArrayList<>();
items.add("a");          // O(1) amortized
items.get(0);            // O(1) access
items.add(1, "x");       // O(n) — shifts elements
items.remove(items.size() - 1);  // O(1)

// Pre-allocate capacity when size is known
ArrayList<String> big = new ArrayList<>(10_000);
```

```typescript
// JavaScript/TypeScript — Array (dynamic by default)
const items: string[] = [];
items.push("a");         // O(1) amortized
items[0];                // O(1) access
items.splice(1, 0, "x"); // O(n) — insert at index
items.pop();             // O(1) — remove last
items.shift();           // O(n) — remove first (shifts all)
```

```cpp
// C++ — std::vector
std::vector<int> items;
items.push_back(10);     // O(1) amortized
items[0];                // O(1) access, no bounds check
items.at(0);             // O(1) access, with bounds check
items.reserve(1000);     // Pre-allocate capacity
items.shrink_to_fit();   // Release unused memory
```

## Best Practices

1. **Pre-allocate capacity** when you know the approximate size — avoids repeated resizing.
2. **Append to the end** — `push`/`append` is O(1); inserting at the front is O(n).
3. **Use `pop()` not `shift()`** — removing from the end is O(1), from the front is O(n).
4. **Avoid repeated concatenation in loops** — in some languages, each concatenation creates a new array.
5. **Consider `deque`** if you need efficient insertion/removal at both ends.

## Anti-patterns / Common Mistakes

- **Inserting/deleting at the front frequently** — use a deque or linked list instead.
- **Not pre-allocating** when size is known — causes unnecessary resize operations.
- **Using `delete` in JavaScript** — creates a sparse array with `undefined` holes; use `splice()` instead.
- **Confusing `length` with capacity** — Java's `ArrayList.size()` vs the internal array length.
- **Quadratic behavior** — inserting n items at position 0 is O(n^2) total.

## Real-world Examples

- **Any list of items** — users, products, orders, log entries.
- **Building results** — collecting query results, filter results, map/reduce operations.
- **Stack implementation** — most stack implementations use a dynamic array internally.
- **Buffer accumulation** — building strings, collecting bytes before writing to disk.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Python TimeComplexity (wiki.python.org)](https://wiki.python.org/moin/TimeComplexity)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Java ArrayList (Oracle)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html)
