# Recursion Fundamentals

> **Domain:** Fundamentals > Algorithms > Recursion
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-07

---

## What It Is

**Recursion** is a method of solving problems where a function calls itself to solve smaller instances of the same problem. It is one of the most powerful and elegant techniques in computer science, enabling concise solutions to problems that have a naturally recursive structure.

Every recursive solution consists of two essential parts:

1. **Base case** (termination condition) -- the simplest instance of the problem that can be solved directly, without further recursion. Without a base case, recursion would continue infinitely.

2. **Recursive case** (problem decomposition) -- the step that reduces the problem into one or more smaller subproblems of the same type, moving closer to the base case with each call.

```
RECURSIVE-FUNCTION(problem):
    if problem is simple enough          ← Base case
        return direct solution
    else                                 ← Recursive case
        break problem into subproblems
        solve each subproblem recursively
        combine subproblem solutions
        return combined result
```

Recursion is intimately connected to mathematical induction. If you can:
1. Solve the base case (n = 0 or n = 1)
2. Assume the solution works for smaller inputs (inductive hypothesis)
3. Show the solution works for the current input using the smaller solutions (inductive step)

...then you have a correct recursive algorithm.

---

## How the Call Stack Works

When a function calls itself, the runtime pushes a new **stack frame** onto the call stack. Each frame contains the function's local variables, parameters, and return address. When the base case is reached, frames begin popping off the stack as each call returns its result.

### Stack Frame Diagram for factorial(4)

```
Call Phase (pushing frames):
┌─────────────────────────────────────────────────────┐
│                                                     │
│  factorial(4)                                       │
│    → calls factorial(3)                             │
│                                                     │
│      factorial(3)                                   │
│        → calls factorial(2)                         │
│                                                     │
│          factorial(2)                               │
│            → calls factorial(1)                     │
│                                                     │
│              factorial(1)                           │
│                → returns 1 (BASE CASE)              │
│                                                     │
└─────────────────────────────────────────────────────┘

Return Phase (popping frames):
┌─────────────────────────────────────────────────────┐
│                                                     │
│  factorial(1) returns 1                             │
│  factorial(2) returns 2 * 1 = 2                     │
│  factorial(3) returns 3 * 2 = 6                     │
│  factorial(4) returns 4 * 6 = 24                    │
│                                                     │
└─────────────────────────────────────────────────────┘

Stack visualization at deepest point:

    ┌─────────────────────┐  ← Top of stack
    │ factorial(1)        │
    │   n = 1             │
    │   return 1          │
    ├─────────────────────┤
    │ factorial(2)        │
    │   n = 2             │
    │   waiting for f(1)  │
    ├─────────────────────┤
    │ factorial(3)        │
    │   n = 3             │
    │   waiting for f(2)  │
    ├─────────────────────┤
    │ factorial(4)        │
    │   n = 4             │
    │   waiting for f(3)  │
    ├─────────────────────┤
    │ main()              │
    │   called f(4)       │
    └─────────────────────┘  ← Bottom of stack
```

### Key Observations

- Each frame occupies memory on the stack (typically 64-128 bytes per frame)
- The maximum stack depth equals the deepest nesting of recursive calls
- If the stack grows too deep, a **stack overflow** occurs (Python default: ~1000 frames; Java: ~5000-10000; C++: depends on stack size, typically ~10000-100000)

---

## Classic Recursive Problems

### 1. Factorial

The factorial of n (written n!) is the product of all positive integers from 1 to n.

```
n! = n * (n-1) * (n-2) * ... * 2 * 1
0! = 1 (by convention)
```

```python
# Python — Factorial
def factorial(n: int) -> int:
    """Calculate n! recursively.
    Base case: 0! = 1! = 1
    Recursive case: n! = n * (n-1)!
    Time: O(n), Space: O(n) for call stack
    """
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Trace: factorial(5)
# factorial(5) = 5 * factorial(4)
#              = 5 * 4 * factorial(3)
#              = 5 * 4 * 3 * factorial(2)
#              = 5 * 4 * 3 * 2 * factorial(1)
#              = 5 * 4 * 3 * 2 * 1
#              = 120
```

```typescript
// TypeScript — Factorial
function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

console.log(factorial(5)); // 120
```

```java
// Java — Factorial
public class Recursion {
    public static long factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
}
```

```cpp
// C++ — Factorial
long long factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
```

```go
// Go — Factorial
func factorial(n int) int {
    if n <= 1 {
        return 1
    }
    return n * factorial(n-1)
}
```

```rust
// Rust — Factorial
fn factorial(n: u64) -> u64 {
    if n <= 1 {
        return 1;
    }
    n * factorial(n - 1)
}
```

---

### 2. Fibonacci

The Fibonacci sequence: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, ...

```
F(0) = 0
F(1) = 1
F(n) = F(n-1) + F(n-2) for n >= 2
```

#### Naive Recursive — O(2^n) Time, O(n) Space

```python
# Python — Naive Fibonacci (EXPONENTIAL — do not use for large n)
def fib_naive(n: int) -> int:
    if n <= 1:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)

# fib_naive(40) takes several seconds
# fib_naive(50) takes minutes
# fib_naive(100) would take longer than the age of the universe
```

```typescript
// TypeScript — Naive Fibonacci
function fibNaive(n: number): number {
    if (n <= 1) return n;
    return fibNaive(n - 1) + fibNaive(n - 2);
}
```

Why is naive Fibonacci so slow? It recomputes the same subproblems exponentially many times:

```
                         fib(5)
                       /        \
                  fib(4)          fib(3)
                /      \         /      \
           fib(3)    fib(2)   fib(2)   fib(1)
          /    \     /    \    /    \
      fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
      /    \
  fib(1) fib(0)

Total calls for fib(5): 15 calls
Total calls for fib(n): approximately 2^n calls
fib(3) computed 2 times, fib(2) computed 3 times!
```

#### Memoized Recursive — O(n) Time, O(n) Space

```python
# Python — Memoized Fibonacci with @lru_cache
from functools import lru_cache

@lru_cache(maxsize=None)
def fib_memo(n: int) -> int:
    if n <= 1:
        return n
    return fib_memo(n - 1) + fib_memo(n - 2)

# fib_memo(100) returns instantly: 354224848179261915075
```

```python
# Python — Memoized Fibonacci with explicit dictionary
def fib_memo_dict(n: int, memo: dict = None) -> int:
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo_dict(n - 1, memo) + fib_memo_dict(n - 2, memo)
    return memo[n]
```

```typescript
// TypeScript — Memoized Fibonacci
function fibMemo(n: number, memo: Map<number, number> = new Map()): number {
    if (memo.has(n)) return memo.get(n)!;
    if (n <= 1) return n;
    const result = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
    memo.set(n, result);
    return result;
}
```

```java
// Java — Memoized Fibonacci
import java.util.HashMap;
import java.util.Map;

public class Fibonacci {
    private Map<Integer, Long> memo = new HashMap<>();

    public long fib(int n) {
        if (n <= 1) return n;
        if (memo.containsKey(n)) return memo.get(n);
        long result = fib(n - 1) + fib(n - 2);
        memo.put(n, result);
        return result;
    }
}
```

#### Iterative (Bottom-Up) — O(n) Time, O(1) Space

```python
# Python — Iterative Fibonacci (most efficient)
def fib_iterative(n: int) -> int:
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

```typescript
// TypeScript — Iterative Fibonacci
function fibIterative(n: number): number {
    if (n <= 1) return n;
    let [a, b] = [0, 1];
    for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
    }
    return b;
}
```

#### Performance Comparison

```
Approach        Time        Space       fib(40) time    fib(100) time
─────────────────────────────────────────────────────────────────────────
Naive           O(2^n)      O(n)        ~5 seconds      heat death of universe
Memoized        O(n)        O(n)        ~instant        ~instant
Iterative       O(n)        O(1)        ~instant        ~instant
Matrix Power    O(log n)    O(1)        ~instant        ~instant
```

---

### 3. Tower of Hanoi

Move n disks from source peg to target peg using an auxiliary peg, following these rules:
1. Only one disk can be moved at a time
2. Only the top disk from a peg can be moved
3. A larger disk cannot be placed on a smaller disk

```python
# Python — Tower of Hanoi
def hanoi(n: int, source: str, target: str, auxiliary: str) -> None:
    """
    Move n disks from source to target using auxiliary.
    Time: O(2^n) — provably optimal
    Total moves: 2^n - 1
    """
    if n == 1:
        print(f"Move disk 1 from {source} to {target}")
        return
    # Move top n-1 disks to auxiliary peg
    hanoi(n - 1, source, auxiliary, target)
    # Move the largest disk to target
    print(f"Move disk {n} from {source} to {target}")
    # Move n-1 disks from auxiliary to target
    hanoi(n - 1, auxiliary, target, source)
```

```typescript
// TypeScript — Tower of Hanoi
function hanoi(n: number, source: string, target: string, auxiliary: string): void {
    if (n === 1) {
        console.log(`Move disk 1 from ${source} to ${target}`);
        return;
    }
    hanoi(n - 1, source, auxiliary, target);
    console.log(`Move disk ${n} from ${source} to ${target}`);
    hanoi(n - 1, auxiliary, target, source);
}

hanoi(3, "A", "C", "B");
```

#### Visual Trace for hanoi(3, "A", "C", "B")

```
Initial State:          After Move 1:          After Move 2:
   |     |     |           |     |     |           |     |     |
   *     |     |           |     |     |           |     |     |
  ***    |     |          ***    |     |           |     |     |
 *****   |     |         *****   |     *           |   *****   *
───A─────B─────C───     ───A─────B─────C───     ───A─────B─────C───
 Move 1: disk 1 A→C     Move 2: disk 2 A→B

After Move 3:           After Move 4:          After Move 5:
   |     |     |           |     |     |           |     |     |
   |     |     |           |     |     |           |     |     |
   |     |     |           |     |     |           |     *     |
   |    ***    *         *****  ***    *         *****  ***    *
───A─────B─────C───     ───A─────B─────C───     ───A─────B─────C───
 Move 3: disk 1 C→B     Move 4: disk 3 A→C     Move 5: disk 1 B→A

After Move 6:           After Move 7 (Final):
   |     |     |           |     |     |
   |     |     |           |     |     *
   |     |     |           |     |    ***
 *****   |    ***          |     |   *****
───A─────B─────C───     ───A─────B─────C───
 Move 6: disk 2 B→C     Move 7: disk 1 A→C

Total moves: 2^3 - 1 = 7 moves
```

---

### 4. Binary Search (Recursive)

```python
# Python — Recursive Binary Search
def binary_search(arr: list[int], target: int, low: int = 0, high: int = None) -> int:
    """
    Find target in sorted array. Returns index or -1 if not found.
    Time: O(log n), Space: O(log n) for call stack
    """
    if high is None:
        high = len(arr) - 1
    if low > high:
        return -1  # Base case: not found

    mid = low + (high - low) // 2  # Avoids integer overflow
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search(arr, target, mid + 1, high)
    else:
        return binary_search(arr, target, low, mid - 1)
```

```typescript
// TypeScript — Recursive Binary Search
function binarySearch(arr: number[], target: number, low = 0, high = arr.length - 1): number {
    if (low > high) return -1; // Base case

    const mid = Math.floor(low + (high - low) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) return binarySearch(arr, target, mid + 1, high);
    return binarySearch(arr, target, low, mid - 1);
}
```

---

### 5. Power Function

#### Naive: O(n)

```python
# Python — Naive power: x^n by multiplying n times
def power_naive(x: float, n: int) -> float:
    if n == 0:
        return 1
    return x * power_naive(x, n - 1)
# power_naive(2, 10) = 2 * 2 * 2 * ... * 2 (10 multiplications)
```

#### Fast (Exponentiation by Squaring): O(log n)

```python
# Python — Fast power using exponentiation by squaring
def power_fast(x: float, n: int) -> float:
    """
    x^n in O(log n) multiplications.
    Key insight: x^n = (x^(n/2))^2 if n is even
                 x^n = x * x^(n-1)  if n is odd
    """
    if n == 0:
        return 1
    if n < 0:
        return power_fast(1 / x, -n)
    if n % 2 == 0:
        half = power_fast(x, n // 2)
        return half * half           # Square the half-result
    else:
        return x * power_fast(x, n - 1)

# power_fast(2, 10):
#   2^10 = (2^5)^2
#   2^5  = 2 * (2^4)
#   2^4  = (2^2)^2
#   2^2  = (2^1)^2
#   2^1  = 2 * (2^0)
#   2^0  = 1
# Only 5 multiplications instead of 10!
```

```typescript
// TypeScript — Fast power
function powerFast(x: number, n: number): number {
    if (n === 0) return 1;
    if (n < 0) return powerFast(1 / x, -n);
    if (n % 2 === 0) {
        const half = powerFast(x, Math.floor(n / 2));
        return half * half;
    }
    return x * powerFast(x, n - 1);
}
```

```rust
// Rust — Fast power
fn power_fast(x: f64, n: i64) -> f64 {
    if n == 0 { return 1.0; }
    if n < 0 { return power_fast(1.0 / x, -n); }
    if n % 2 == 0 {
        let half = power_fast(x, n / 2);
        half * half
    } else {
        x * power_fast(x, n - 1)
    }
}
```

---

### 6. Tree Traversals

Trees are inherently recursive data structures -- every subtree is itself a tree.

```python
# Python — Binary tree node and traversals
class TreeNode:
    def __init__(self, val: int, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder(node: TreeNode) -> list[int]:
    """Left → Root → Right. Produces sorted order for BST."""
    if node is None:
        return []
    return inorder(node.left) + [node.val] + inorder(node.right)

def preorder(node: TreeNode) -> list[int]:
    """Root → Left → Right. Used for serialization / copying."""
    if node is None:
        return []
    return [node.val] + preorder(node.left) + preorder(node.right)

def postorder(node: TreeNode) -> list[int]:
    """Left → Right → Root. Used for deletion / cleanup."""
    if node is None:
        return []
    return postorder(node.left) + postorder(node.right) + [node.val]
```

```typescript
// TypeScript — Tree traversals
interface TreeNode {
    val: number;
    left: TreeNode | null;
    right: TreeNode | null;
}

function inorder(node: TreeNode | null): number[] {
    if (!node) return [];
    return [...inorder(node.left), node.val, ...inorder(node.right)];
}

function preorder(node: TreeNode | null): number[] {
    if (!node) return [];
    return [node.val, ...preorder(node.left), ...preorder(node.right)];
}

function postorder(node: TreeNode | null): number[] {
    if (!node) return [];
    return [...postorder(node.left), ...postorder(node.right), node.val];
}
```

```
Example tree:
         4
        / \
       2   6
      / \ / \
     1  3 5  7

Inorder:   [1, 2, 3, 4, 5, 6, 7]  ← sorted!
Preorder:  [4, 2, 1, 3, 6, 5, 7]
Postorder: [1, 3, 2, 5, 7, 6, 4]
```

---

### 7. Merge Sort

A divide-and-conquer sorting algorithm that naturally expresses as recursion.

```python
# Python — Merge Sort
def merge_sort(arr: list[int]) -> list[int]:
    """
    Divide array in half, sort each half, merge.
    Time: O(n log n), Space: O(n)
    """
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])     # Sort left half
    right = merge_sort(arr[mid:])    # Sort right half
    return merge(left, right)        # Merge sorted halves

def merge(left: list[int], right: list[int]) -> list[int]:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
```

```typescript
// TypeScript — Merge Sort
function mergeSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;

    const mid = Math.floor(arr.length / 2);
    const left = mergeSort(arr.slice(0, mid));
    const right = mergeSort(arr.slice(mid));
    return mergeSorted(left, right);
}

function mergeSorted(left: number[], right: number[]): number[] {
    const result: number[] = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
        if (left[i] <= right[j]) {
            result.push(left[i++]);
        } else {
            result.push(right[j++]);
        }
    }
    return [...result, ...left.slice(i), ...right.slice(j)];
}
```

```
Merge Sort Recursion Tree for [38, 27, 43, 3, 9, 82, 10]:

                    [38, 27, 43, 3, 9, 82, 10]
                   /                           \
          [38, 27, 43, 3]                [9, 82, 10]
          /            \                 /          \
      [38, 27]      [43, 3]        [9, 82]       [10]
       /    \        /    \         /    \
     [38]  [27]   [43]   [3]     [9]  [82]

     Merge up:
     [27, 38]    [3, 43]       [9, 82]     [10]
          \        /                \        /
      [3, 27, 38, 43]           [9, 10, 82]
               \                   /
        [3, 9, 10, 27, 38, 43, 82]
```

---

## Recursion vs Iteration

Every recursive algorithm can be converted to an iterative one (and vice versa). The choice between them involves trade-offs:

### Comparison Table

```
Aspect           Recursion                        Iteration
─────────────────────────────────────────────────────────────────────────────
Readability      Often cleaner for tree/graph      Clearer for simple loops
                 problems and D&C algorithms       and accumulations

Stack Usage      Uses O(depth) stack frames;       Constant stack usage;
                 risk of stack overflow             no overflow risk

Performance      Function call overhead per        Lower overhead per
                 frame (~10-50 nanoseconds)         iteration

Memory           Extra memory for stack frames     Can often use O(1) space
                 and saved local variables

Debugging        Stack traces show call history;    Simpler to step through;
                 can be hard with deep recursion     easier to inspect state

State Mgmt       State is implicit in the stack    State must be managed
                 (automatic backtracking)           explicitly (manual stack)

When to Use      Trees, graphs, D&C, backtracking, Simple loops, performance-
                 problems with recursive structure  critical code, deep recursion
```

### Same Problem Both Ways: Sum of Array

```python
# Python — Recursive sum
def sum_recursive(arr: list[int], index: int = 0) -> int:
    if index == len(arr):          # Base case: no more elements
        return 0
    return arr[index] + sum_recursive(arr, index + 1)

# Python — Iterative sum
def sum_iterative(arr: list[int]) -> int:
    total = 0
    for x in arr:
        total += x
    return total
```

```typescript
// TypeScript — Recursive sum
function sumRecursive(arr: number[], index: number = 0): number {
    if (index === arr.length) return 0;
    return arr[index] + sumRecursive(arr, index + 1);
}

// TypeScript — Iterative sum
function sumIterative(arr: number[]): number {
    let total = 0;
    for (const x of arr) {
        total += x;
    }
    return total;
}
```

### Same Problem Both Ways: Reversing a String

```python
# Python — Recursive reverse
def reverse_recursive(s: str) -> str:
    if len(s) <= 1:
        return s
    return reverse_recursive(s[1:]) + s[0]

# Python — Iterative reverse
def reverse_iterative(s: str) -> str:
    result = []
    for i in range(len(s) - 1, -1, -1):
        result.append(s[i])
    return "".join(result)

# Or simply: s[::-1]
```

```typescript
// TypeScript — Recursive reverse
function reverseRecursive(s: string): string {
    if (s.length <= 1) return s;
    return reverseRecursive(s.slice(1)) + s[0];
}

// TypeScript — Iterative reverse
function reverseIterative(s: string): string {
    return s.split("").reverse().join("");
}
```

---

## Tail Recursion

**Tail recursion** occurs when the recursive call is the **last operation** in the function -- meaning the function returns the result of the recursive call directly, without performing any additional computation after the call returns.

### Why Tail Recursion Matters

A tail-recursive function can be optimized by the compiler/interpreter into a loop (**Tail Call Optimization, TCO**). Instead of pushing a new stack frame, the runtime reuses the current frame, eliminating stack overflow risk and reducing memory usage from O(n) to O(1).

### Non-Tail vs Tail Recursive Factorial

```python
# Python — NOT tail recursive
def factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * factorial(n - 1)    # ← multiplication happens AFTER the recursive call
                                    #   so the current frame must be kept alive

# Python — Tail recursive (with accumulator)
def factorial_tail(n: int, acc: int = 1) -> int:
    if n <= 1:
        return acc                  # ← return the accumulated result directly
    return factorial_tail(n - 1, n * acc)  # ← recursive call IS the last action
                                            #   no work after it returns
```

```typescript
// TypeScript — Non-tail recursive
function factorialNonTail(n: number): number {
    if (n <= 1) return 1;
    return n * factorialNonTail(n - 1);  // Must wait for result, then multiply
}

// TypeScript — Tail recursive
function factorialTail(n: number, acc: number = 1): number {
    if (n <= 1) return acc;
    return factorialTail(n - 1, n * acc);  // Tail position — can be optimized
}
```

```go
// Go — Tail recursive Fibonacci
func fibTail(n int, a int, b int) int {
    if n == 0 {
        return a
    }
    return fibTail(n-1, b, a+b) // Tail call — Go doesn't TCO, but it's the pattern
}
// Usage: fibTail(10, 0, 1) → 55
```

```rust
// Rust — Tail recursive factorial (Rust doesn't guarantee TCO either)
fn factorial_tail(n: u64, acc: u64) -> u64 {
    if n <= 1 { return acc; }
    factorial_tail(n - 1, n * acc)
}
// Usage: factorial_tail(20, 1)
```

### TCO Support by Language

```
Language        TCO Supported?   Notes
────────────────────────────────────────────────────────────────────────────────
Scheme          Yes              Required by specification (R5RS and later)
Haskell         Yes              Lazy evaluation + GHC optimization
Erlang/Elixir   Yes              Essential for actor-model infinite loops
Scala           Yes              @tailrec annotation; compiler-enforced
Kotlin          Yes              tailrec keyword; compiler-verified
JavaScript      Partial          ES2015 spec says yes, but only Safari implements
Python          No               Guido explicitly rejected TCO for Python
Java            No               JVM does not support TCO (as of Java 21)
C/C++           Sometimes        GCC/Clang may optimize with -O2, not guaranteed
Go              No               Deliberate design choice
Rust            No               Not guaranteed, though LLVM may optimize
```

### Converting Tail Recursion to Iteration

Tail-recursive functions convert trivially to loops:

```python
# Tail recursive factorial
def factorial_tail(n, acc=1):
    if n <= 1: return acc
    return factorial_tail(n - 1, n * acc)

# Equivalent iterative version (direct mechanical translation)
def factorial_iterative(n):
    acc = 1
    while n > 1:       # Loop condition = negation of base case
        acc = n * acc  # Update accumulator (same as recursive step)
        n = n - 1      # Update parameter (same as recursive step)
    return acc
```

---

## Tree Recursion vs Linear Recursion

### Linear Recursion

Each function call makes at most **one** recursive call. The call structure is a straight line.

```
factorial(4) → factorial(3) → factorial(2) → factorial(1) → return

Depth: n
Total calls: n
Time: O(n)
Space: O(n)
```

### Tree Recursion

Each function call makes **two or more** recursive calls. The call structure is a tree.

```
Call tree for fib(5):

                            fib(5)
                          /        \
                     fib(4)          fib(3)
                    /      \         /      \
               fib(3)    fib(2)   fib(2)   fib(1)
              /    \     /    \    /    \      |
          fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)  return 1
          /    \    |     |      |      |      |
      fib(1) fib(0) 1    1      0      1      0
         |      |
         1      0

Depth: n
Total calls: ~2^n (exponential!)
Time: O(2^n) without memoization
Space: O(n) — only n frames on stack at any time
         (depth of the tree, not total nodes)
```

### Other Examples of Tree Recursion

```python
# Python — Generating all subsets (power set) — tree recursion
def subsets(arr: list[int]) -> list[list[int]]:
    if not arr:
        return [[]]
    first = arr[0]
    rest_subsets = subsets(arr[1:])   # One recursive call
    # But we use its result twice (conceptually tree-like branching)
    with_first = [[first] + s for s in rest_subsets]
    return rest_subsets + with_first

# subsets([1, 2, 3]) → [[], [3], [2], [2,3], [1], [1,3], [1,2], [1,2,3]]
# Total subsets: 2^n
```

```typescript
// TypeScript — Generating permutations — tree recursion
function permutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];

    const result: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const perms = permutations(rest);  // n-1 recursive calls per level!
        for (const perm of perms) {
            result.push([arr[i], ...perm]);
        }
    }
    return result;
}
// Time: O(n * n!) — tree with branching factor n
```

---

## Memoization

**Memoization** is a top-down optimization technique that caches the results of function calls. When the function is called again with the same arguments, the cached result is returned instead of recomputing it.

Memoization transforms tree recursion (exponential) into linear recursion (polynomial) by ensuring each unique subproblem is solved only once.

### Without vs With Memoization

```python
# Python — Without memoization: O(2^n) time
def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

# With memoization: O(n) time
from functools import lru_cache

@lru_cache(maxsize=None)
def fib_memo(n: int) -> int:
    if n <= 1:
        return n
    return fib_memo(n - 1) + fib_memo(n - 2)
```

```typescript
// TypeScript — Generic memoize function
function memoize<T extends (...args: any[]) => any>(fn: T): T {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>): ReturnType<T> => {
        const key = JSON.stringify(args);
        if (cache.has(key)) return cache.get(key)!;
        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as T;
}

const fibMemoized = memoize((n: number): number => {
    if (n <= 1) return n;
    return fibMemoized(n - 1) + fibMemoized(n - 2);
});
```

### Memoization Call Tree for fib(5)

```
Without memoization (15 calls):

                     fib(5)
                   /        \
              fib(4)          fib(3)
             /      \         /      \
        fib(3)    fib(2)   fib(2)   fib(1)
       /    \     /    \    /    \
   fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
   /    \
fib(1) fib(0)

With memoization (only 9 calls, and 4 are cache hits):

              fib(5)
             /      \
        fib(4)    fib(3) ← CACHED (already computed)
       /      \
  fib(3)    fib(2) ← CACHED
 /      \
fib(2) fib(1) ← CACHED
/    \
fib(1) fib(0)

Unique computations: fib(0), fib(1), fib(2), fib(3), fib(4), fib(5) — exactly n+1
```

### Memoization vs Tabulation (Bottom-Up DP)

```
Approach        Direction     Space        When to Use
─────────────────────────────────────────────────────────────────────────────
Memoization     Top-down      O(n) cache   When not all subproblems needed;
(Recursive)                   + O(n) stack natural recursive structure

Tabulation      Bottom-up     O(n) table   When all subproblems must be solved;
(Iterative)                   (no stack)   want to avoid stack overflow
```

```python
# Python — Tabulation (bottom-up DP)
def fib_tabulation(n: int) -> int:
    if n <= 1:
        return n
    table = [0] * (n + 1)
    table[1] = 1
    for i in range(2, n + 1):
        table[i] = table[i - 1] + table[i - 2]
    return table[n]
```

---

## Recursion Pitfalls

### 1. Stack Overflow

Deep recursion exceeds the call stack limit.

```python
# Python — This will crash with RecursionError for n > ~1000
def countdown(n: int) -> None:
    if n == 0:
        return
    countdown(n - 1)

# countdown(10000) → RecursionError: maximum recursion depth exceeded

# Workaround (not recommended for production):
import sys
sys.setrecursionlimit(100000)  # Increase limit, but risks segfault

# Better: convert to iteration
def countdown_iterative(n: int) -> None:
    while n > 0:
        n -= 1
```

```
Default recursion limits:
  Python:   ~1,000 (configurable via sys.setrecursionlimit)
  Java:     ~5,000-10,000 (depends on stack size, configurable with -Xss)
  C++:      ~10,000-100,000 (depends on OS stack size)
  JavaScript: ~10,000-25,000 (engine-dependent)
  Go:       ~1,000,000 (goroutine stacks grow dynamically)
  Rust:     ~10,000 (default 8 MB stack, configurable)
```

### 2. Redundant Computation

Without memoization, tree recursion recomputes the same subproblems.

```python
# Computing fib(50) without memo:
#   fib(48) is computed 2 times
#   fib(47) is computed 3 times
#   fib(46) is computed 5 times
#   fib(45) is computed 8 times
#   ...
#   fib(1) is computed 12,586,269,025 times!
```

### 3. Missing or Incorrect Base Case

```python
# BUG: Missing base case — infinite recursion
def factorial_bug(n):
    return n * factorial_bug(n - 1)  # Never stops!

# BUG: Wrong base case — misses negative inputs
def factorial_bug2(n):
    if n == 0:
        return 1
    return n * factorial_bug2(n - 1)
# factorial_bug2(-1) → infinite recursion (never reaches 0)

# FIXED: Handle edge cases
def factorial_safe(n):
    if n < 0:
        raise ValueError("Factorial not defined for negative numbers")
    if n <= 1:
        return 1
    return n * factorial_safe(n - 1)
```

### 4. Excessive Space Usage

```python
# This creates n lists during recursion — O(n^2) space!
def reverse_bad(arr):
    if not arr:
        return []
    return reverse_bad(arr[1:]) + [arr[0]]  # arr[1:] creates a NEW list each time

# Better: use indices to avoid copying
def reverse_good(arr, start=0, end=None):
    if end is None:
        end = len(arr) - 1
    if start >= end:
        return
    arr[start], arr[end] = arr[end], arr[start]
    reverse_good(arr, start + 1, end - 1)
```

### 5. Modifying Shared State

```python
# BUG: Mutable default argument is shared across calls
def collect_bad(n, result=[]):      # ← DEFAULT LIST IS SHARED!
    if n <= 0:
        return result
    result.append(n)
    return collect_bad(n - 1, result)

# First call: collect_bad(3) → [3, 2, 1] — correct
# Second call: collect_bad(3) → [3, 2, 1, 3, 2, 1] — wrong!

# FIXED: Use None as default
def collect_good(n, result=None):
    if result is None:
        result = []
    if n <= 0:
        return result
    result.append(n)
    return collect_good(n - 1, result)
```

---

## When to Use Recursion

### Good Candidates for Recursion

```
Problem Type                   Why Recursion Works Well                  Example
────────────────────────────────────────────────────────────────────────────────────────
Tree traversal                 Trees are recursive structures           DFS, inorder
Graph exploration              Naturally explores neighbors depth-first  DFS, cycle detect
Divide & conquer               Split-solve-combine maps to recursion    Merge sort, QSort
Backtracking                   Try-fail-undo needs stack behavior        N-Queens, Sudoku
Combinatorial generation       Subsets, permutations branch recursively  Power set
Parsing                        Grammar rules are recursive productions   Expression parser
Mathematical definitions       Many math functions defined recursively   Factorial, GCD
Nested/hierarchical data       JSON, XML, file systems are tree-shaped   Deep clone, search
```

### When NOT to Use Recursion

```
Scenario                              Why                                      Alternative
────────────────────────────────────────────────────────────────────────────────────────────────────
Simple iteration (sum, max)           Unnecessary overhead                      for/while loop
Very deep recursion (n > 10,000)      Stack overflow risk                       Iterative + explicit stack
Performance-critical inner loops      Function call overhead adds up            Loop unrolling
Linear DP (1D table)                  Iteration is simpler and faster           for loop + array
When iterative version is equally     No benefit from recursion                 Iteration
  readable
```

---

## Recursive Data Structures

Many data structures are inherently recursive -- they are defined in terms of themselves.

### Linked List

A linked list is either empty (null) or a node containing a value and a reference to another linked list.

```python
# Python — Recursive linked list operations
class ListNode:
    def __init__(self, val: int, next: 'ListNode' = None):
        self.val = val
        self.next = next

def length(node: ListNode) -> int:
    if node is None:
        return 0
    return 1 + length(node.next)

def contains(node: ListNode, target: int) -> bool:
    if node is None:
        return False
    if node.val == target:
        return True
    return contains(node.next, target)

def reverse_list(node: ListNode) -> ListNode:
    if node is None or node.next is None:
        return node
    new_head = reverse_list(node.next)
    node.next.next = node
    node.next = None
    return new_head
```

```typescript
// TypeScript — Recursive linked list
class ListNode {
    constructor(public val: number, public next: ListNode | null = null) {}
}

function length(node: ListNode | null): number {
    if (!node) return 0;
    return 1 + length(node.next);
}

function printList(node: ListNode | null): void {
    if (!node) {
        console.log("null");
        return;
    }
    process.stdout.write(`${node.val} -> `);
    printList(node.next);
}
```

### Trees

A tree is either empty or a node containing a value and zero or more child trees.

```python
# Python — Recursive tree operations
def height(node: TreeNode) -> int:
    if node is None:
        return -1  # Convention: empty tree has height -1
    return 1 + max(height(node.left), height(node.right))

def count_nodes(node: TreeNode) -> int:
    if node is None:
        return 0
    return 1 + count_nodes(node.left) + count_nodes(node.right)

def is_balanced(node: TreeNode) -> bool:
    if node is None:
        return True
    left_h = height(node.left)
    right_h = height(node.right)
    return (abs(left_h - right_h) <= 1
            and is_balanced(node.left)
            and is_balanced(node.right))
```

### Nested Objects (JSON)

```python
# Python — Recursively process nested JSON-like data
def deep_find(obj, target_key):
    """Find all values for a given key in arbitrarily nested dicts/lists."""
    results = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key == target_key:
                results.append(value)
            results.extend(deep_find(value, target_key))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(deep_find(item, target_key))
    return results

# Example:
data = {
    "name": "root",
    "children": [
        {"name": "child1", "children": [{"name": "grandchild1"}]},
        {"name": "child2"},
    ]
}
print(deep_find(data, "name"))
# → ['root', 'child1', 'grandchild1', 'child2']
```

```typescript
// TypeScript — Deep clone of nested object
function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }
    const cloned: any = {};
    for (const key of Object.keys(obj)) {
        cloned[key] = deepClone((obj as any)[key]);
    }
    return cloned;
}
```

### File System Directories

```python
# Python — Recursively list all files in a directory tree
import os

def list_all_files(directory: str) -> list[str]:
    files = []
    for entry in os.listdir(directory):
        full_path = os.path.join(directory, entry)
        if os.path.isfile(full_path):
            files.append(full_path)
        elif os.path.isdir(full_path):
            files.extend(list_all_files(full_path))  # Recurse into subdirectory
    return files
```

---

## Advanced: Converting Recursion to Iteration with Explicit Stack

Any recursive algorithm can be converted to an iterative one using an explicit stack. This avoids stack overflow while preserving the recursive logic.

```python
# Python — DFS on a tree: recursive vs iterative

# Recursive DFS (preorder)
def dfs_recursive(node):
    if node is None:
        return
    print(node.val)                    # Process
    dfs_recursive(node.left)           # Recurse left
    dfs_recursive(node.right)          # Recurse right

# Iterative DFS with explicit stack
def dfs_iterative(root):
    if root is None:
        return
    stack = [root]
    while stack:
        node = stack.pop()
        print(node.val)                # Process
        if node.right:                 # Push right first (LIFO → left processed first)
            stack.append(node.right)
        if node.left:
            stack.append(node.left)
```

```typescript
// TypeScript — Iterative DFS with explicit stack
function dfsIterative(root: TreeNode | null): number[] {
    if (!root) return [];
    const result: number[] = [];
    const stack: TreeNode[] = [root];
    while (stack.length > 0) {
        const node = stack.pop()!;
        result.push(node.val);
        if (node.right) stack.push(node.right);
        if (node.left) stack.push(node.left);
    }
    return result;
}
```

```java
// Java — Iterative inorder traversal (more complex)
public List<Integer> inorderIterative(TreeNode root) {
    List<Integer> result = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode current = root;

    while (current != null || !stack.isEmpty()) {
        // Go as far left as possible
        while (current != null) {
            stack.push(current);
            current = current.left;
        }
        // Process node
        current = stack.pop();
        result.add(current.val);
        // Move to right subtree
        current = current.right;
    }
    return result;
}
```

---

## Key Takeaways

```
  1. Every recursive function needs a BASE CASE (termination) and a
     RECURSIVE CASE (decomposition toward the base case).

  2. The call stack stores frames for each recursive call. Deep recursion
     risks stack overflow.

  3. MEMOIZATION eliminates redundant computation in tree recursion,
     transforming O(2^n) into O(n) for problems like Fibonacci.

  4. TAIL RECURSION (recursive call as last action) can be optimized to
     use O(1) stack space — but only in languages that support TCO.

  5. Recursion excels for trees, graphs, D&C, and backtracking — problems
     with natural recursive structure.

  6. For simple loops, iteration is preferred: less overhead, no stack risk,
     often clearer.

  7. Any recursion can be converted to iteration using an EXPLICIT STACK.

  8. Always ask: Does the recursive structure add clarity? Or would a
     simple loop be more readable and efficient?
```

---

## Related Topics

- [Algorithms Overview](../../01-overview/algorithms-overview/algorithms-overview.md)
- [Complexity Analysis & Big O](../../02-complexity-analysis/complexity-and-big-o/complexity-and-big-o.md)
- [Dynamic Programming](../../07-dynamic-programming/)
- [Divide and Conquer](../../09-divide-and-conquer/)
- [Backtracking](../../10-backtracking/)
- [Tree Algorithms](../../12-tree-algorithms/)

---

## Sources

1. **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** (2022). *Introduction to Algorithms* (4th ed.), Chapters 2, 4, 7. MIT Press. (Divide and conquer, recurrences, merge sort, quicksort)
2. **Abelson, H., & Sussman, G. J.** (1996). *Structure and Interpretation of Computer Programs* (2nd ed.), Chapter 1. MIT Press. (Tree recursion, linear recursion, iterative processes, tail calls)
3. **Sedgewick, R., & Wayne, K.** (2011). *Algorithms* (4th ed.), Chapter 1. Addison-Wesley. (Recursion patterns in sorting and searching)
4. **Skiena, S. S.** (2020). *The Algorithm Design Manual* (3rd ed.), Chapter 8. Springer. (Backtracking and recursive combinatorial generation)
5. **Graham, R. L., Knuth, D. E., & Patashnik, O.** (1994). *Concrete Mathematics* (2nd ed.). Addison-Wesley. (Recurrence relations and solving techniques)
6. **Wikipedia** -- "Recursion (computer science)," "Tail call," "Memoization." https://en.wikipedia.org/wiki/Recursion_(computer_science)
