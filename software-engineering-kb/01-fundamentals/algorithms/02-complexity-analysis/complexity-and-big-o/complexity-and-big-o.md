# Complexity Analysis & Big O Notation

> **Domain:** Fundamentals > Algorithms > Complexity Analysis
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-07

---

## What It Is

**Complexity analysis** is the study of how an algorithm's resource consumption (time and space) grows as the input size increases. It provides a framework for comparing algorithms independent of hardware, programming language, or implementation details.

**Big O notation** is the most commonly used asymptotic notation. It describes the **upper bound** of an algorithm's growth rate, capturing the worst-case scaling behavior while abstracting away constants and lower-order terms.

The central question complexity analysis answers is: **"If I double the input size, how much longer will the algorithm take?"**

```
Algorithm with O(n):     Double input → ~2x time
Algorithm with O(n^2):   Double input → ~4x time
Algorithm with O(n^3):   Double input → ~8x time
Algorithm with O(2^n):   Double input → time SQUARES
```

---

## Asymptotic Notations

Asymptotic notation provides a mathematical framework for describing the limiting behavior of functions. There are five main notations:

### Big O -- Upper Bound (Most Common)

**Definition:** f(n) = O(g(n)) if there exist positive constants c and n_0 such that:

```
f(n) <= c * g(n)    for all n >= n_0
```

**Meaning:** f(n) grows **no faster** than g(n), up to a constant factor, for sufficiently large n.

**Analogy:** "At most" / "<=" -- an upper bound on growth.

```
Example: f(n) = 3n^2 + 5n + 7

Choose c = 4, n_0 = 8:
  3n^2 + 5n + 7  <=  4n^2    for all n >= 8

Therefore: 3n^2 + 5n + 7 = O(n^2)
```

### Big Omega (Omega) -- Lower Bound

**Definition:** f(n) = Omega(g(n)) if there exist positive constants c and n_0 such that:

```
f(n) >= c * g(n)    for all n >= n_0
```

**Meaning:** f(n) grows **at least as fast** as g(n).

**Analogy:** "At least" / ">=" -- a lower bound on growth.

```
Example: f(n) = 3n^2 + 5n + 7

Choose c = 3, n_0 = 1:
  3n^2 + 5n + 7  >=  3n^2    for all n >= 1

Therefore: 3n^2 + 5n + 7 = Omega(n^2)
```

### Big Theta (Theta) -- Tight Bound

**Definition:** f(n) = Theta(g(n)) if and only if f(n) = O(g(n)) AND f(n) = Omega(g(n)).

Equivalently, there exist positive constants c_1, c_2, and n_0 such that:

```
c_1 * g(n) <= f(n) <= c_2 * g(n)    for all n >= n_0
```

**Meaning:** f(n) grows **at exactly the same rate** as g(n), within constant factors.

**Analogy:** "Exactly" / "==" -- a tight bound.

```
Example: f(n) = 3n^2 + 5n + 7

Choose c_1 = 3, c_2 = 4, n_0 = 8:
  3n^2  <=  3n^2 + 5n + 7  <=  4n^2    for all n >= 8

Therefore: 3n^2 + 5n + 7 = Theta(n^2)
```

### Little o -- Strict Upper Bound

**Definition:** f(n) = o(g(n)) if for **every** positive constant c, there exists n_0 such that:

```
f(n) < c * g(n)    for all n >= n_0
```

Equivalently: lim(n->infinity) f(n)/g(n) = 0

**Meaning:** f(n) grows **strictly slower** than g(n). Not just bounded above, but dominated.

```
Example: n = o(n^2)     because  lim n/n^2 = lim 1/n = 0
         n^2 != o(n^2)  because  lim n^2/n^2 = 1 != 0
```

### Little omega -- Strict Lower Bound

**Definition:** f(n) = omega(g(n)) if for **every** positive constant c, there exists n_0 such that:

```
f(n) > c * g(n)    for all n >= n_0
```

Equivalently: lim(n->infinity) f(n)/g(n) = infinity

**Meaning:** f(n) grows **strictly faster** than g(n).

### Summary of All Notations

```
Notation    Analogy    Formal Condition                       Example
─────────────────────────────────────────────────────────────────────────────────
O(g(n))     <=         f(n) <= c*g(n)  for some c, large n    2n+3 = O(n)
Omega(g(n)) >=         f(n) >= c*g(n)  for some c, large n    2n+3 = Omega(n)
Theta(g(n)) ==         c1*g <= f <= c2*g for some c1,c2,n0    2n+3 = Theta(n)
o(g(n))     <          f(n) < c*g(n) for ALL c, large n       n = o(n^2)
omega(g(n)) >          f(n) > c*g(n) for ALL c, large n       n^2 = omega(n)
```

---

## Common Complexity Classes

### Growth Rate Table

```
Class         Name            Example                     n=10    n=100     n=1,000     n=1,000,000
──────────────────────────────────────────────────────────────────────────────────────────────────────
O(1)          Constant        Array index, hash lookup     1       1         1           1
O(log n)      Logarithmic     Binary search                3.3     6.6       10          20
O(sqrt(n))    Square root     Prime check trial div.       3.2     10        31.6        1,000
O(n)          Linear          Linear scan, single loop     10      100       1,000       1,000,000
O(n log n)    Linearithmic    Merge sort, heap sort        33      664       9,966       19,931,569
O(n^2)        Quadratic       Bubble sort, nested loops    100     10,000    1,000,000   10^12
O(n^3)        Cubic           Naive matrix multiply        1,000   10^6      10^9        10^18
O(2^n)        Exponential     All subsets, brute TSP       1,024   10^30     10^301      --
O(n!)         Factorial       All permutations             3.6M    10^157    --          --
```

### Visual Growth Comparison

```
Operations
    |
10^9|                                                 .  2^n
    |                                              .
    |                                           .
    |                                        .
    |                                     .       n^3
    |                                  .      ...
    |                              .      ...
    |                           .     ...        n^2
    |                        .    ...         ...
    |                     .   ...          ...
    |                  .  ...           ...
    |              .  ...           ...
    |          .. ...           ....          n log n
    |      ....  ..         ....        .......
    |   ...   ...       ....      ......
    | ..   ...      ....    ......               n
    |.  ...    ....   ......
    |...   ....  .....                        log n
    |.. .... .....................................
    |..............________________________________ O(1)
    └──────────────────────────────────────────── n
    1      10      100     1000    10000
```

### Detailed Class Descriptions

#### O(1) -- Constant Time

The algorithm takes the same amount of time regardless of input size.

```python
# Python
def get_first(arr: list) -> any:
    return arr[0]                    # O(1)

def hash_lookup(d: dict, key: str):
    return d.get(key)               # O(1) average

def is_even(n: int) -> bool:
    return n % 2 == 0               # O(1)
```

```typescript
// TypeScript
function getFirst<T>(arr: T[]): T {
    return arr[0];                    // O(1)
}

function hashLookup(map: Map<string, number>, key: string): number | undefined {
    return map.get(key);              // O(1) average
}
```

#### O(log n) -- Logarithmic Time

The problem size is halved (or reduced by a constant fraction) at each step.

```python
# Python — Binary Search
def binary_search(arr: list[int], target: int) -> int:
    low, high = 0, len(arr) - 1
    while low <= high:              # Loop runs at most log2(n) times
        mid = (low + high) // 2     # O(1) per iteration
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1           # Discard lower half
        else:
            high = mid - 1          # Discard upper half
    return -1
```

```typescript
// TypeScript — Binary Search
function binarySearch(arr: number[], target: number): number {
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {           // O(log n) iterations
        const mid = Math.floor((low + high) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
```

#### O(n) -- Linear Time

Each element is processed once (or a constant number of times).

```python
# Python — Finding maximum
def find_max(arr: list[int]) -> int:
    max_val = arr[0]                # O(1)
    for x in arr:                   # O(n) iterations
        if x > max_val:             # O(1) per iteration
            max_val = x
    return max_val                  # Total: O(n)
```

```java
// Java — Sum of array
public static int sum(int[] arr) {
    int total = 0;                  // O(1)
    for (int x : arr) {             // O(n) iterations
        total += x;                 // O(1) per iteration
    }
    return total;                   // Total: O(n)
}
```

#### O(n log n) -- Linearithmic Time

Characteristic of efficient comparison-based sorting and divide-and-conquer algorithms.

```python
# Python — Merge Sort
def merge_sort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])      # T(n/2)
    right = merge_sort(arr[mid:])     # T(n/2)
    return merge(left, right)         # O(n)
    # Total: T(n) = 2T(n/2) + O(n) = O(n log n)

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

#### O(n^2) -- Quadratic Time

Typically involves nested loops over the input.

```python
# Python — Bubble Sort
def bubble_sort(arr: list[int]) -> list[int]:
    n = len(arr)
    for i in range(n):                  # O(n)
        for j in range(0, n - i - 1):   # O(n) inner loop
            if arr[j] > arr[j + 1]:     # O(1) per comparison
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr                          # Total: O(n^2)
```

```cpp
// C++ — Check all pairs
bool hasDuplicatePair(const std::vector<int>& arr) {
    for (int i = 0; i < arr.size(); i++) {        // O(n)
        for (int j = i + 1; j < arr.size(); j++) { // O(n)
            if (arr[i] == arr[j]) return true;      // O(1)
        }
    }
    return false;  // Total: O(n^2)
}
```

---

## How to Calculate Big O

### Rule 1: Drop Constants

Constants do not affect the growth rate.

```python
# This is O(n), NOT O(3n)
def example(arr):
    for x in arr:       # n operations
        print(x)
    for x in arr:       # n operations
        print(x)
    for x in arr:       # n operations
        print(x)
    # Total: 3n operations → O(n)
```

### Rule 2: Drop Lower-Order Terms

Only the fastest-growing term matters.

```python
# This is O(n^2), NOT O(n^2 + n)
def example(arr):
    for x in arr:                    # O(n)
        print(x)
    for x in arr:                    # O(n^2) — this dominates
        for y in arr:
            print(x, y)
    # Total: n + n^2 → O(n^2)
```

### Rule 3: Sequential Statements Add

```python
# O(n) + O(m) = O(n + m)
def example(arr1, arr2):
    for x in arr1:      # O(n)  where n = len(arr1)
        print(x)
    for y in arr2:      # O(m)  where m = len(arr2)
        print(y)
    # Total: O(n + m)
    # Note: if arr1 and arr2 are the same array, this is O(n) + O(n) = O(n)
```

```typescript
// TypeScript — O(n) + O(n) = O(n), NOT O(n^2)
function processArrayTwice(arr: number[]): void {
    // First pass — O(n)
    for (const x of arr) {
        console.log(x);
    }
    // Second pass — O(n)
    for (const x of arr) {
        console.log(x * 2);
    }
    // Total: O(n) + O(n) = O(2n) = O(n)
}
```

### Rule 4: Nested Loops Multiply

```python
# O(n * m)
def example(arr1, arr2):
    for x in arr1:           # O(n) outer
        for y in arr2:       # O(m) inner — runs m times PER outer iteration
            print(x, y)
    # Total: O(n * m)
    # If arr1 == arr2 (same array of size n): O(n^2)
```

```typescript
// TypeScript — Nested loops
function printPairs(arr: number[]): void {
    for (let i = 0; i < arr.length; i++) {           // O(n)
        for (let j = i + 1; j < arr.length; j++) {   // O(n) in worst case
            console.log(arr[i], arr[j]);
        }
    }
    // n*(n-1)/2 iterations = O(n^2)
}
```

### Rule 5: Different Inputs Use Different Variables

```python
# CORRECT: O(a * b), where a = len(arr1), b = len(arr2)
# WRONG: O(n^2)
def example(arr1, arr2):
    for x in arr1:          # O(a)
        for y in arr2:      # O(b)
            print(x, y)
    # Total: O(a * b) — NOT O(n^2) unless a == b == n
```

```typescript
// TypeScript — Two different inputs
function crossProduct(a: number[], b: number[]): void {
    for (const x of a) {       // O(|a|)
        for (const y of b) {   // O(|b|)
            console.log(x * y);
        }
    }
    // Total: O(|a| * |b|), NOT O(n^2)
}
```

### Rule 6: Logarithmic — Halving the Problem

```python
# O(log n) — problem size halved each iteration
def count_halvings(n: int) -> int:
    count = 0
    while n > 1:
        n = n // 2       # halve the problem
        count += 1
    return count          # returns floor(log2(n))
```

### Comprehensive Line-by-Line Analysis Example

```python
def complex_example(arr: list[int], matrix: list[list[int]]) -> int:
    n = len(arr)                          # O(1)
    total = 0                             # O(1)

    # Block 1: O(n)
    for i in range(n):                    # O(n) iterations
        total += arr[i]                   # O(1) per iteration

    # Block 2: O(n^2)
    for i in range(n):                    # O(n) outer
        for j in range(n):               # O(n) inner
            total += matrix[i][j]         # O(1) per iteration

    # Block 3: O(n)
    for i in range(n):                    # O(n) iterations
        total += i * i                    # O(1) per iteration

    # Block 4: O(log n)
    k = n
    while k > 1:                          # O(log n) iterations
        total += k                        # O(1) per iteration
        k = k // 2

    return total
    # Total: O(1) + O(n) + O(n^2) + O(n) + O(log n) = O(n^2)
    # The O(n^2) term dominates all others
```

```typescript
// TypeScript — Complete analysis
function analyzeComplexity(arr: number[]): number {
    const n = arr.length;                     // O(1)
    let result = 0;                           // O(1)

    // O(n log n) — outer O(n), inner O(log n)
    for (let i = 0; i < n; i++) {             // O(n)
        let j = n;
        while (j > 0) {                      // O(log n) — halving
            result += arr[i] + j;             // O(1)
            j = Math.floor(j / 2);
        }
    }

    // O(n) — single pass
    for (let i = 0; i < n; i++) {             // O(n)
        result += arr[i];                     // O(1)
    }

    return result;
    // Total: O(n log n) + O(n) = O(n log n)
}
```

---

## Space Complexity

Space complexity measures the additional memory an algorithm uses beyond the input itself.

### Components of Space Complexity

```
Total space = Input space + Auxiliary space
                             ├── Variables and constants
                             ├── Data structures (arrays, hash maps, etc.)
                             └── Call stack (recursion depth)

Convention: We typically report AUXILIARY space only.
```

### Space Complexity Examples

```python
# O(1) space — In-place modification
def reverse_array(arr: list[int]) -> None:
    left, right = 0, len(arr) - 1      # O(1) extra space
    while left < right:
        arr[left], arr[right] = arr[right], arr[left]
        left += 1
        right -= 1

# O(n) space — New array created
def merge_sort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])         # O(n/2) for the slice
    right = merge_sort(arr[mid:])        # O(n/2) for the slice
    return merge(left, right)            # O(n) for merged result
    # Total auxiliary space: O(n)

# O(log n) space — Recursion stack only
def quicksort(arr: list[int], low: int, high: int) -> None:
    if low < high:
        pivot = partition(arr, low, high)   # O(1) auxiliary space
        quicksort(arr, low, pivot - 1)      # Recursion depth: O(log n) average
        quicksort(arr, pivot + 1, high)
    # Auxiliary space: O(log n) for the call stack (average case)
    # Worst case: O(n) call stack if always unbalanced partition
```

```typescript
// TypeScript — O(n) space with hash set
function findDuplicates(arr: number[]): number[] {
    const seen = new Set<number>();          // Up to O(n) space
    const duplicates: number[] = [];         // Up to O(n) space
    for (const num of arr) {
        if (seen.has(num)) {
            duplicates.push(num);
        }
        seen.add(num);
    }
    return duplicates;
    // Time: O(n), Space: O(n)
}

// TypeScript — O(1) space with two pointers
function removeDuplicatesSorted(arr: number[]): number {
    if (arr.length === 0) return 0;
    let writeIdx = 1;                        // O(1) space
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1]) {
            arr[writeIdx] = arr[i];
            writeIdx++;
        }
    }
    return writeIdx;
    // Time: O(n), Space: O(1)
}
```

### Sorting Algorithms: Space Comparison

```
Algorithm          Time (Average)    Space       In-Place?   Stable?
────────────────────────────────────────────────────────────────────────
Bubble Sort        O(n^2)           O(1)        Yes         Yes
Selection Sort     O(n^2)           O(1)        Yes         No
Insertion Sort     O(n^2)           O(1)        Yes         Yes
Merge Sort         O(n log n)       O(n)        No          Yes
Quick Sort         O(n log n)       O(log n)*   Yes         No
Heap Sort          O(n log n)       O(1)        Yes         No
Counting Sort      O(n + k)         O(k)        No          Yes
Radix Sort         O(d(n + k))      O(n + k)    No          Yes

* Quick Sort space is O(log n) average for recursion stack, O(n) worst case
```

---

## Best, Average, and Worst Case

Every algorithm has multiple performance profiles depending on the specific input.

### QuickSort: The Classic Example

```python
def quicksort(arr, low, high):
    if low < high:
        pivot_index = partition(arr, low, high)
        quicksort(arr, low, pivot_index - 1)
        quicksort(arr, pivot_index + 1, high)

def partition(arr, low, high):
    pivot = arr[high]    # Choosing last element as pivot
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1
```

```
Case        Input Example              Partition Behavior       Recurrence           Complexity
────────────────────────────────────────────────────────────────────────────────────────────────────
Best        Pivot always median         Balanced: n/2 + n/2      T(n) = 2T(n/2) + n   O(n log n)
Average     Random input, random pivot  Roughly balanced         T(n) = 2T(n/2) + n   O(n log n)
Worst       Already sorted, pivot=last  1 + (n-1) every time     T(n) = T(n-1) + n    O(n^2)
```

```
Best Case Partition Tree:          Worst Case Partition Tree:

       [n]                              [n]
      /   \                            /   \
   [n/2] [n/2]                      [1]  [n-1]
   / \    / \                            /   \
 [n/4]  [n/4]  ...                    [1]  [n-2]
                                          /   \
Depth: log n                           [1]  [n-3]
Work per level: n                           ...
Total: n * log n = O(n log n)
                                    Depth: n
                                    Work per level: n, n-1, n-2, ...
                                    Total: n(n-1)/2 = O(n^2)
```

### Other Examples

```
Algorithm         Best Case        Average Case     Worst Case
────────────────────────────────────────────────────────────────────────
Linear Search     O(1) — first     O(n/2) = O(n)    O(n) — last or absent
Binary Search     O(1) — middle    O(log n)         O(log n) — absent
Insertion Sort    O(n) — sorted    O(n^2)           O(n^2) — reverse sorted
Hash Table Get    O(1) — no coll.  O(1) — few coll. O(n) — all collide
```

---

## Amortized Analysis

Amortized analysis computes the **average cost per operation** over a worst-case sequence of operations. This is NOT the same as average-case analysis (which considers random inputs).

### The Dynamic Array (ArrayList) Problem

When a dynamic array is full and we append an element, it must:
1. Allocate a new array of double the size
2. Copy all existing elements
3. Add the new element

Individual worst case: O(n) for resize. But most appends are O(1).

### Aggregate Method

Count total cost of n operations, then divide by n.

```
Operation     1   2   3   4   5   6   7   8   9   10  ...
Cost          1   1   1+2 1   1+4 1   1   1+8 1   1   ...
                      (resize)  (resize)      (resize)

Resizes happen at operations: 3, 5, 9, 17, 33, ... (at powers of 2 + 1)
Resize costs: 2, 4, 8, 16, 32, ...

Total cost for n operations:
  = n (for n individual insertions of cost 1)
  + (1 + 2 + 4 + 8 + ... + n)  (for copy costs during resizes)
  = n + (2n - 1)
  = 3n - 1
  = O(n)

Amortized cost per operation = O(n) / n = O(1)
```

### Accounting Method (Banker's Method)

Assign each operation a fixed "charge." Overcharges on cheap operations build up "credit" to pay for expensive ones.

```
Charge each append $3:
  $1 — pays for the insertion itself
  $1 — pays for copying THIS element during a future resize
  $1 — pays for copying a PREVIOUS element that has no credit

After n insertions into capacity n, we have n/2 elements with $1 credit
(elements inserted since last resize). These credits pay for the O(n)
copy during the next resize.

Since each operation is charged $3 = O(1), amortized cost is O(1).
```

### Code Example: Dynamic Array Amortization

```python
class DynamicArray:
    def __init__(self):
        self._capacity = 1
        self._size = 0
        self._data = [None] * self._capacity

    def append(self, value):
        if self._size == self._capacity:
            self._resize(2 * self._capacity)  # O(n) — but rare
        self._data[self._size] = value         # O(1)
        self._size += 1

    def _resize(self, new_capacity):
        new_data = [None] * new_capacity       # O(n)
        for i in range(self._size):            # O(n) — copy all elements
            new_data[i] = self._data[i]
        self._data = new_data
        self._capacity = new_capacity

    # Despite occasional O(n) resizes, append is O(1) AMORTIZED
    # because resizes happen exponentially less frequently
```

```typescript
// TypeScript — Demonstrating amortized append
class DynamicArray<T> {
    private data: (T | undefined)[];
    private size: number;

    constructor() {
        this.data = new Array(1);
        this.size = 0;
    }

    append(value: T): void {
        if (this.size === this.data.length) {
            this.resize(2 * this.data.length);  // O(n), but rare
        }
        this.data[this.size] = value;           // O(1)
        this.size++;
    }

    private resize(newCapacity: number): void {
        const newData = new Array(newCapacity);
        for (let i = 0; i < this.size; i++) {
            newData[i] = this.data[i];          // O(n) copy
        }
        this.data = newData;
    }
    // Amortized: O(1) per append
}
```

### Potential Method

Define a potential function Phi that maps the state of the data structure to a non-negative number. The amortized cost of operation i is:

```
amortized_cost_i = actual_cost_i + Phi(state_after_i) - Phi(state_before_i)

For dynamic array with n elements and capacity c:
  Phi = 2*size - capacity

When NOT resizing (size < capacity):
  actual cost = 1
  Phi_after - Phi_before = 2(size+1) - capacity - (2*size - capacity) = 2
  amortized cost = 1 + 2 = 3

When resizing (size == capacity, new capacity = 2*size):
  actual cost = 1 + size (copy all elements)
  Phi_before = 2*size - size = size
  Phi_after = 2*(size+1) - 2*size = 2
  amortized cost = (1 + size) + 2 - size = 3

Both cases: amortized cost = 3 = O(1)
```

---

## Master Theorem

The Master Theorem provides a cookbook method for solving divide-and-conquer recurrences of the form:

```
T(n) = a * T(n/b) + f(n)

Where:
  a >= 1  — number of subproblems
  b > 1   — factor by which problem size is reduced
  f(n)    — cost of dividing and combining
```

### The Three Cases

```
Let c_crit = log_b(a)    (critical exponent)

Case 1: f(n) = O(n^(c_crit - epsilon)) for some epsilon > 0
         → Subproblems dominate
         → T(n) = Theta(n^c_crit)

Case 2: f(n) = Theta(n^c_crit * (log n)^k) for some k >= 0
         → Work is evenly distributed
         → T(n) = Theta(n^c_crit * (log n)^(k+1))

Case 3: f(n) = Omega(n^(c_crit + epsilon)) for some epsilon > 0
         AND a*f(n/b) <= c*f(n) for some c < 1 (regularity condition)
         → Combine step dominates
         → T(n) = Theta(f(n))
```

### Example Applications

#### Merge Sort: T(n) = 2T(n/2) + O(n)

```
a = 2, b = 2, f(n) = n
c_crit = log_2(2) = 1

f(n) = n = Theta(n^1) = Theta(n^c_crit)

→ Case 2 (k=0): T(n) = Theta(n^1 * log n) = Theta(n log n)
```

#### Binary Search: T(n) = T(n/2) + O(1)

```
a = 1, b = 2, f(n) = 1
c_crit = log_2(1) = 0

f(n) = 1 = Theta(n^0) = Theta(n^c_crit)

→ Case 2 (k=0): T(n) = Theta(n^0 * log n) = Theta(log n)
```

#### Strassen's Matrix Multiplication: T(n) = 7T(n/2) + O(n^2)

```
a = 7, b = 2, f(n) = n^2
c_crit = log_2(7) ≈ 2.807

f(n) = n^2 = O(n^(2.807 - 0.807))

→ Case 1 (epsilon = 0.807): T(n) = Theta(n^2.807) ≈ Theta(n^2.81)
  (Better than naive O(n^3)!)
```

#### Karatsuba Multiplication: T(n) = 3T(n/2) + O(n)

```
a = 3, b = 2, f(n) = n
c_crit = log_2(3) ≈ 1.585

f(n) = n = O(n^(1.585 - 0.585))

→ Case 1 (epsilon = 0.585): T(n) = Theta(n^1.585) ≈ Theta(n^1.58)
  (Better than naive O(n^2) grade-school multiplication!)
```

### Master Theorem Quick Reference

```
Recurrence                a    b    f(n)      c_crit    Case    T(n)
──────────────────────────────────────────────────────────────────────────────
T(n) = T(n/2) + 1        1    2    1         0         2       O(log n)
T(n) = T(n/2) + n        1    2    n         0         3       O(n)
T(n) = 2T(n/2) + 1       2    2    1         1         1       O(n)
T(n) = 2T(n/2) + n       2    2    n         1         2       O(n log n)
T(n) = 2T(n/2) + n^2     2    2    n^2       1         3       O(n^2)
T(n) = 4T(n/2) + n       4    2    n         2         1       O(n^2)
T(n) = 4T(n/2) + n^2     4    2    n^2       2         2       O(n^2 log n)
T(n) = 4T(n/2) + n^3     4    2    n^3       2         3       O(n^3)
T(n) = 7T(n/2) + n^2     7    2    n^2       2.807     1       O(n^2.807)
T(n) = 3T(n/2) + n       3    2    n         1.585     1       O(n^1.585)
```

---

## Common Mistakes in Complexity Analysis

### Mistake 1: Confusing O(n) with Actual Running Time

```
Big O says nothing about actual wall-clock time.
An O(n) algorithm with a huge constant can be slower than
an O(n^2) algorithm for small n.

Example: O(1000000 * n) is still O(n), but for n < 1000000,
         an O(n^2) algorithm might be faster in practice.
```

### Mistake 2: Two Different Inputs

```python
# WRONG analysis: "This is O(n^2)"
def intersect(list_a, list_b):
    for a in list_a:         # O(|A|)
        for b in list_b:     # O(|B|)
            if a == b:
                return True
    return False
# CORRECT: O(|A| * |B|) or O(a * b) — two independent inputs
```

### Mistake 3: Ignoring Hidden Costs

```python
# This looks like O(n) but string concatenation is O(k) where k is string length
def build_string_bad(n):
    result = ""
    for i in range(n):
        result += str(i)    # Each concatenation creates a new string: O(1 + 2 + ... + n) = O(n^2)
    return result

# Correct O(n) approach
def build_string_good(n):
    parts = []
    for i in range(n):
        parts.append(str(i))  # O(1) amortized per append
    return "".join(parts)      # O(n) join
```

### Mistake 4: Misunderstanding Log Base

```
In Big O, the base of the logarithm does not matter:
  log_2(n) = log_10(n) / log_10(2) = log_10(n) * constant

So O(log_2 n) = O(log_10 n) = O(ln n) = O(log n)

The base only matters when computing exact values, not asymptotic growth.
```

### Mistake 5: Premature Optimization

```
"Premature optimization is the root of all evil." — Donald Knuth

Before optimizing:
  1. Profile to find actual bottlenecks
  2. Check if the algorithm is the right one (algorithmic improvement >>> constant improvement)
  3. Consider readability and maintainability
  4. O(n^2) for n < 100 is probably fine
```

### Mistake 6: Confusing Time and Space

```python
# Time: O(n), Space: O(n)
def create_copy(arr):
    return list(arr)     # Creates new list of size n

# Time: O(n), Space: O(1)
def modify_in_place(arr):
    for i in range(len(arr)):
        arr[i] *= 2      # Modifies existing array, no extra space
```

---

## Practical Implications

### What Complexity Means in Real Time

Assuming 10^9 simple operations per second (modern CPU):

```
n              O(log n)    O(n)       O(n log n)    O(n^2)        O(2^n)
────────────────────────────────────────────────────────────────────────────────
10             ~instant    ~instant   ~instant      ~instant      ~instant
100            ~instant    ~instant   ~instant      ~instant      10^13 years
1,000          ~instant    ~instant   ~instant      0.001 sec     10^284 years
10,000         ~instant    ~instant   ~instant      0.1 sec       --
100,000        ~instant    ~instant   0.002 sec     10 sec        --
1,000,000      ~instant    0.001 sec  0.02 sec      17 min        --
10,000,000     ~instant    0.01 sec   0.2 sec       ~28 hours     --
100,000,000    ~instant    0.1 sec    2.7 sec       ~3.2 years    --
1,000,000,000  ~instant    1 sec      30 sec        ~317 years    --
```

### Maximum Input Size by Time Limit

Given a time limit (e.g., 1-2 seconds in competitive programming):

```
Complexity       Max n (at 10^8 ops/sec)    Max n (at 10^9 ops/sec)
────────────────────────────────────────────────────────────────────
O(n!)            ~11                         ~12
O(2^n)           ~25                         ~28
O(n^3)           ~500                        ~1,000
O(n^2)           ~10,000                     ~31,600
O(n * sqrt(n))   ~100,000                    ~400,000
O(n log n)       ~5,000,000                  ~50,000,000
O(n)             ~100,000,000                ~1,000,000,000
O(log n)         Any practical n             Any practical n
O(1)             Any n                       Any n
```

### Choosing the Right Algorithm Based on Input Size

```python
# Practical guideline for competitive programming / interviews:
#
# n <= 12      → O(n!) or O(2^n * n) — brute force permutations/subsets
# n <= 25      → O(2^n) — bitmask enumeration
# n <= 100     → O(n^3) — Floyd-Warshall, cubic DP
# n <= 5000    → O(n^2) — quadratic DP, all-pairs
# n <= 10^6    → O(n log n) — sorting-based, divide and conquer
# n <= 10^8    → O(n) — linear scan, two pointers, sliding window
# n <= 10^18   → O(log n) or O(1) — binary search, math formula
```

---

## Complexity of Common Data Structure Operations

```
Data Structure       Access    Search    Insert    Delete    Space
──────────────────────────────────────────────────────────────────────────
Array                O(1)      O(n)      O(n)      O(n)      O(n)
Dynamic Array        O(1)      O(n)      O(1)*     O(n)      O(n)
Linked List          O(n)      O(n)      O(1)**    O(1)**    O(n)
Stack                O(n)      O(n)      O(1)      O(1)      O(n)
Queue                O(n)      O(n)      O(1)      O(1)      O(n)
Hash Table           N/A       O(1)*     O(1)*     O(1)*     O(n)
BST (balanced)       O(log n)  O(log n)  O(log n)  O(log n)  O(n)
BST (unbalanced)     O(n)      O(n)      O(n)      O(n)      O(n)
Heap                 O(1)***   O(n)      O(log n)  O(log n)  O(n)
Trie                 N/A       O(k)      O(k)      O(k)      O(n*k)

 *  Amortized
 ** With reference to the node (O(n) if searching first)
*** Access to min/max only; arbitrary access is O(n)
```

---

## Recurrence Relations Beyond Master Theorem

### Akra-Bazzi Method (Generalized Master Theorem)

Handles recurrences where subproblems have unequal sizes:

```
T(n) = T(n/3) + T(2n/3) + n

Cannot use Master Theorem (a1*T(n/b1) + a2*T(n/b2) form)
Akra-Bazzi gives: T(n) = Theta(n log n)
```

### Recursion Tree Method

Draw the recursion tree, sum work at each level:

```
T(n) = 2T(n/2) + n

Level 0:              n                    Work = n
Level 1:        n/2     n/2                Work = n
Level 2:     n/4  n/4  n/4  n/4           Work = n
...           ...                          ...
Level k:     1 1 1 1 ... 1 1 1 1          Work = n

Height = log2(n), Work per level = n
Total = n * log2(n) = O(n log n)
```

### Substitution Method

Guess the solution, then prove by induction:

```
Claim: T(n) = 2T(n/2) + n has solution T(n) = O(n log n)

Guess: T(n) <= c * n * log(n) for some constant c

Inductive step:
  T(n) = 2T(n/2) + n
       <= 2 * c * (n/2) * log(n/2) + n
       = c * n * (log(n) - 1) + n
       = c * n * log(n) - c * n + n
       <= c * n * log(n)    when c >= 1

Base case: T(1) = 1 <= c * 1 * log(1) = 0... need to handle small n separately.
Choose n_0 = 2: T(2) = 2T(1) + 2 = 4 <= c * 2 * 1 when c >= 2.
```

---

## Key Takeaways

```
  1. Big O describes the UPPER BOUND of growth rate, not actual running time.

  2. Focus on the dominant term: n^2 + n + 1 = O(n^2).

  3. Use different variables for different inputs: O(n*m), not O(n^2).

  4. Amortized O(1) does NOT mean every operation is O(1); it means the
     average over a worst-case sequence is O(1).

  5. The Master Theorem solves T(n) = aT(n/b) + f(n) recurrences in 3 cases.

  6. Know the practical limits: O(n^2) is feasible for n ≈ 10,000;
     O(n log n) handles n ≈ 10,000,000; O(2^n) maxes out around n ≈ 25.

  7. Space complexity matters too — an O(n) algorithm using O(n^2) space
     may be worse than an O(n log n) algorithm using O(1) space.

  8. Always measure before optimizing. Profile first, then choose the right
     algorithm, then optimize constants.
```

---

## Related Topics

- [Algorithms Overview](../../01-overview/algorithms-overview/algorithms-overview.md)
- [Recursion Fundamentals](../../03-recursion/recursion-fundamentals/recursion-fundamentals.md)
- [Big O Cheatsheet](../../../data-structures/07-complexity-and-selection/big-o-cheatsheet/)

---

## Sources

1. **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** (2022). *Introduction to Algorithms* (4th ed.), Chapters 3-4. MIT Press. (Formal definitions of asymptotic notation, Master Theorem, amortized analysis)
2. **Skiena, S. S.** (2020). *The Algorithm Design Manual* (3rd ed.), Chapter 2. Springer. (Practical complexity analysis)
3. **Sedgewick, R., & Wayne, K.** (2011). *Algorithms* (4th ed.), Chapter 1.4. Addison-Wesley. (Analysis of algorithms)
4. **Sipser, M.** (2012). *Introduction to the Theory of Computation* (3rd ed.). Cengage. (Complexity classes P and NP)
5. **Wikipedia** -- "Big O notation," "Master theorem," "Amortized analysis." https://en.wikipedia.org/wiki/Big_O_notation
6. **Big-O Cheat Sheet** -- https://www.bigocheatsheet.com/ (Quick reference for common data structures and algorithms)
