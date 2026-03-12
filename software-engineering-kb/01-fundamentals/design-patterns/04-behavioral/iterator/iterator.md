# Iterator Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The Iterator pattern provides a way to access elements of a collection **sequentially without exposing its underlying representation**. The client code works with a simple `next()`/`hasNext()` interface, regardless of whether the underlying structure is an array, tree, graph, or database cursor.

**GoF Intent:** "Provide a way to access the elements of an aggregate object sequentially without exposing its underlying representation."

## How It Works

```typescript
// Custom iterable — TypeScript Symbol.iterator protocol
class Range {
  constructor(private start: number, private end: number) {}

  [Symbol.iterator](): Iterator<number> {
    let current = this.start;
    const end = this.end;
    return {
      next(): IteratorResult<number> {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
}

// Usage — works with for..of, spread, destructuring
for (const n of new Range(1, 5)) {
  console.log(n);  // 1, 2, 3, 4, 5
}
const nums = [...new Range(1, 3)];  // [1, 2, 3]
```

```python
# Python — __iter__ and __next__ protocol
class Fibonacci:
    def __init__(self, max_count: int):
        self.max_count = max_count

    def __iter__(self):
        self.a, self.b = 0, 1
        self.count = 0
        return self

    def __next__(self):
        if self.count >= self.max_count:
            raise StopIteration
        self.count += 1
        self.a, self.b = self.b, self.a + self.b
        return self.a

# Usage
for n in Fibonacci(10):
    print(n)  # 1, 1, 2, 3, 5, 8, 13, 21, 34, 55

# Generator — simpler way to create iterators
def fibonacci(max_count: int):
    a, b = 0, 1
    for _ in range(max_count):
        a, b = b, a + b
        yield a
```

```java
// Java — Iterable and Iterator
public class Tree<T> implements Iterable<T> {
    private Node<T> root;

    @Override
    public Iterator<T> iterator() {
        return new InOrderIterator<>(root);  // can swap traversal strategy
    }
}

// Usage
for (Integer value : tree) {
    System.out.println(value);  // inorder traversal
}
```

## Real-world Examples

- **Python generators** — `yield` creates implicit iterators.
- **Java `Iterable`/`Iterator`** — every collection implements `Iterable`.
- **JavaScript `Symbol.iterator`** — arrays, maps, sets, strings all implement it.
- **Database cursors** — iterate over query results row by row.
- **Java Streams** — `stream().filter().map()` is an iterator pipeline.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 257-271.
- [Refactoring.Guru — Iterator](https://refactoring.guru/design-patterns/iterator)
