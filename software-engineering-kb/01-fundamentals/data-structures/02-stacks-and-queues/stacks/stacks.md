# Stacks

> **Domain:** Fundamentals > Data Structures > Stacks and Queues
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

A stack is a linear data structure that follows the **LIFO (Last In, First Out)** principle. The last element added is the first one removed. Think of a stack of plates — you can only add or remove from the top.

The two primary operations are:
- **Push** — add an element to the top.
- **Pop** — remove and return the top element.

## Why It Matters

- **Fundamental to how programs execute** — every function call creates a stack frame on the call stack.
- **Essential for backtracking** — undo operations, browser history, DFS traversal.
- **Used in parsing** — expression evaluation, bracket matching, compiler syntax analysis.
- **Simple and predictable** — O(1) for all primary operations with no edge cases.

## How It Works

### Visual Model

```
Push A, B, C:          Pop:

     ┌───┐             ┌───┐
     │ C │ ← top       │ C │ ← removed (returned)
     ├───┤             ├───┤
     │ B │             │ B │ ← new top
     ├───┤             ├───┤
     │ A │             │ A │
     └───┘             └───┘
```

### Operations and Time Complexity

| Operation | Time | Space |
|-----------|------|-------|
| Push | O(1) | O(1) |
| Pop | O(1) | O(1) |
| Peek/Top | O(1) | O(1) |
| IsEmpty | O(1) | O(1) |
| Search | O(n) | O(1) |

### Implementation (Array-based)

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);  // O(1) amortized
  }

  pop(): T | undefined {
    return this.items.pop();  // O(1)
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  get size(): number {
    return this.items.length;
  }
}
```

```python
# Python — use a list as a stack
stack = []
stack.append("A")  # push
stack.append("B")
stack.append("C")
top = stack.pop()  # "C"
peek = stack[-1]   # "B" (peek without removing)
```

```java
// Java — use Deque (preferred over Stack class)
Deque<String> stack = new ArrayDeque<>();
stack.push("A");
stack.push("B");
String top = stack.pop();   // "B"
String peek = stack.peek(); // "A"
```

### Classic Applications

**Bracket Matching:**
```typescript
function isBalanced(s: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (const char of s) {
    if ('([{'.includes(char)) {
      stack.push(char);
    } else if (char in pairs) {
      if (stack.pop() !== pairs[char]) return false;
    }
  }
  return stack.length === 0;
}
```

**Postfix Expression Evaluation:**
```python
def evaluate_postfix(tokens: list[str]) -> float:
    stack = []
    for token in tokens:
        if token in '+-*/':
            b, a = stack.pop(), stack.pop()
            if token == '+': stack.append(a + b)
            elif token == '-': stack.append(a - b)
            elif token == '*': stack.append(a * b)
            elif token == '/': stack.append(a / b)
        else:
            stack.append(float(token))
    return stack[0]

# "3 4 + 2 *" = (3 + 4) * 2 = 14
evaluate_postfix(["3", "4", "+", "2", "*"])  # → 14.0
```

**DFS (Iterative):**
```typescript
function dfs(graph: Map<string, string[]>, start: string): string[] {
  const visited = new Set<string>();
  const stack = [start];
  const result: string[] = [];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    result.push(node);
    for (const neighbor of graph.get(node) || []) {
      stack.push(neighbor);
    }
  }
  return result;
}
```

## Best Practices

1. **Use a dynamic array** (not a linked list) as the underlying structure — better cache performance.
2. **In Java, use `ArrayDeque`** instead of the legacy `Stack` class (which is synchronized and slow).
3. **Check for empty before popping** — or use a return type that handles the empty case.
4. **Consider monotonic stacks** for problems involving "next greater/smaller element."
5. **Mind the call stack limit** — deep recursion can overflow; convert to iterative with an explicit stack.

## Anti-patterns / Common Mistakes

- **Stack overflow from unbounded recursion** — always have a base case and consider iterative alternatives.
- **Using Java's `Stack` class** — it extends `Vector` with synchronization overhead. Use `ArrayDeque` instead.
- **Forgetting LIFO order** — when converting recursion to iteration, push elements in reverse order.
- **Memory leaks** — in languages with manual memory management, popped elements must be freed.

## Real-world Examples

- **Call stack** — every programming language uses a stack for function calls and local variables.
- **Undo/Redo** — text editors push actions onto an undo stack; undo pops and pushes to redo stack.
- **Browser back button** — visited pages form a stack.
- **Compiler parsing** — syntax analysis, expression parsing, scope resolution.
- **Maze solving** — DFS with backtracking uses a stack.

## Sources

- Cormen, T. et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Java ArrayDeque (Oracle)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html)
