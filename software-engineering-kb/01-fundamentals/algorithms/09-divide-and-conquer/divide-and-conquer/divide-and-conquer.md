# Divide and Conquer — Fundamentals

| Domain | Difficulty | Last Updated |
|---|---|---|
| Fundamentals > Algorithms > Divide and Conquer | Intermediate | 2026-03-07 |

---

## What It Is

**Divide and Conquer (D&C)** is an algorithm design paradigm that solves problems through three steps:

1. **Divide** — Break the problem into smaller subproblems of the same type.
2. **Conquer** — Solve the subproblems recursively. If small enough, solve directly (base case).
3. **Combine** — Merge the solutions of subproblems into a solution for the original problem.

The key insight is that the **combine step** should be efficient. If combining is expensive, the
overall algorithm may not gain anything from the divide step.

```
Divide and Conquer Structure:

                    Problem
                   /       \
              Divide         Divide
             /     \        /     \
         Sub-1   Sub-2   Sub-3   Sub-4
           │       │       │       │
        Solve   Solve   Solve   Solve     ← Conquer (base cases)
           │       │       │       │
           └───┬───┘       └───┬───┘
            Combine         Combine       ← Combine partial solutions
               │               │
               └───────┬───────┘
                    Combine
                       │
                    Solution
```

**D&C vs Dynamic Programming:**
The crucial difference is that D&C subproblems are **independent** (non-overlapping), while DP
subproblems **overlap** (the same subproblem appears multiple times). If you apply D&C to a problem
with overlapping subproblems, you waste work recomputing the same results. That is when you switch
to DP (memoization / tabulation).

---

## Classic D&C Algorithms

### 1. Merge Sort (The Canonical D&C Example)

**Idea:** Divide the array in half, recursively sort each half, merge the two sorted halves.

```
Merge Sort Visualization:

  [38, 27, 43, 3, 9, 82, 10]
              │
         ┌────┴────┐
   [38, 27, 43, 3]  [9, 82, 10]
      │                   │
   ┌──┴──┐           ┌───┴───┐
 [38,27] [43,3]    [9,82]  [10]
   │       │         │       │
 ┌─┴─┐  ┌─┴─┐     ┌─┴─┐    │
[38][27][43][3]  [9][82]  [10]    ← Base cases (single elements)
   │       │       │       │
 [27,38] [3,43] [9,82]  [10]      ← Merge pairs
    │       │       │       │
  [3,27,38,43]  [9,10,82]         ← Merge sorted halves
        │             │
   [3, 9, 10, 27, 38, 43, 82]     ← Final merge
```

**Python:**

```python
def merge_sort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr

    # Divide
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    # Combine (merge)
    return merge(left, right)

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

# In-place merge sort variant (more memory-efficient)
def merge_sort_inplace(arr: list[int], left: int = 0, right: int = None) -> None:
    if right is None:
        right = len(arr) - 1
    if left >= right:
        return

    mid = (left + right) // 2
    merge_sort_inplace(arr, left, mid)
    merge_sort_inplace(arr, mid + 1, right)
    merge_inplace(arr, left, mid, right)

def merge_inplace(arr: list[int], left: int, mid: int, right: int) -> None:
    temp = arr[left:right + 1]
    i, j = 0, mid - left + 1
    k = left

    while i <= mid - left and j <= right - left:
        if temp[i] <= temp[j]:
            arr[k] = temp[i]
            i += 1
        else:
            arr[k] = temp[j]
            j += 1
        k += 1

    while i <= mid - left:
        arr[k] = temp[i]
        i += 1
        k += 1
    while j <= right - left:
        arr[k] = temp[j]
        j += 1
        k += 1

arr = [38, 27, 43, 3, 9, 82, 10]
print(merge_sort(arr))  # [3, 9, 10, 27, 38, 43, 82]
```

**TypeScript:**

```typescript
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

    return result.concat(left.slice(i), right.slice(j));
}

console.log(mergeSort([38, 27, 43, 3, 9, 82, 10]));
// [3, 9, 10, 27, 38, 43, 82]
```

**Analysis:**
- **Recurrence:** T(n) = 2T(n/2) + O(n)
- **Time:** O(n log n) in all cases (best, average, worst)
- **Space:** O(n) auxiliary
- **Stable:** Yes (preserves relative order of equal elements)

---

### 2. Quick Sort

**Idea:** Choose a **pivot**, partition the array so elements less than pivot are on the left and
greater on the right, recursively sort each partition. The partition step is the key work.

```
Quick Sort Visualization (pivot = last element):

  [10, 7, 8, 9, 1, 5]       pivot = 5
                │
  Partition: [1] [5] [10, 7, 8, 9]
               │          │
              done    pivot = 9
                          │
              [7, 8] [9] [10]
                │          │
              pivot=8    done
                │
             [7] [8]
               │
             done

  Result: [1, 5, 7, 8, 9, 10]
```

**Python:**

```python
import random

def quick_sort(arr: list[int]) -> list[int]:
    """Simple quick sort (creates new arrays)."""
    if len(arr) <= 1:
        return arr

    pivot = arr[random.randint(0, len(arr) - 1)]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]

    return quick_sort(left) + middle + quick_sort(right)

def quick_sort_inplace(arr: list[int], low: int = 0, high: int = None) -> None:
    """In-place quick sort with random pivot."""
    if high is None:
        high = len(arr) - 1
    if low >= high:
        return

    pivot_idx = partition(arr, low, high)
    quick_sort_inplace(arr, low, pivot_idx - 1)
    quick_sort_inplace(arr, pivot_idx + 1, high)

def partition(arr: list[int], low: int, high: int) -> int:
    """Lomuto partition scheme with random pivot."""
    pivot_idx = random.randint(low, high)
    arr[pivot_idx], arr[high] = arr[high], arr[pivot_idx]
    pivot = arr[high]
    i = low - 1

    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]

    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

arr = [10, 7, 8, 9, 1, 5]
quick_sort_inplace(arr)
print(arr)  # [1, 5, 7, 8, 9, 10]
```

**TypeScript:**

```typescript
function quickSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;

    const pivotIdx = Math.floor(Math.random() * arr.length);
    const pivot = arr[pivotIdx];
    const left = arr.filter((x, i) => x < pivot || (x === pivot && i < pivotIdx));
    const right = arr.filter((x, i) => x > pivot || (x === pivot && i > pivotIdx));

    return [...quickSort(left), pivot, ...quickSort(right)];
}

function quickSortInPlace(arr: number[], low = 0, high = arr.length - 1): void {
    if (low >= high) return;

    const pivotIdx = partitionArr(arr, low, high);
    quickSortInPlace(arr, low, pivotIdx - 1);
    quickSortInPlace(arr, pivotIdx + 1, high);
}

function partitionArr(arr: number[], low: number, high: number): number {
    const pivotIdx = low + Math.floor(Math.random() * (high - low + 1));
    [arr[pivotIdx], arr[high]] = [arr[high], arr[pivotIdx]];
    const pivot = arr[high];
    let i = low - 1;

    for (let j = low; j < high; j++) {
        if (arr[j] <= pivot) {
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
    return i + 1;
}
```

**Analysis:**
- **Recurrence (average):** T(n) = 2T(n/2) + O(n) -> O(n log n)
- **Recurrence (worst):** T(n) = T(n-1) + O(n) -> O(n^2) (when pivot is always min/max)
- **Space:** O(log n) average stack depth, O(n) worst case
- **Stable:** No (in-place version)
- **Practical note:** Despite O(n^2) worst case, quick sort is often faster than merge sort due
  to better cache locality and smaller constant factors. Random pivot makes worst case extremely
  unlikely.

---

### 3. Binary Search

**Idea:** Search a sorted array by repeatedly dividing the search interval in half.

**Python:**

```python
def binary_search(arr: list[int], target: int) -> int:
    """Returns index of target, or -1 if not found."""
    low, high = 0, len(arr) - 1

    while low <= high:
        mid = low + (high - low) // 2   # avoid overflow
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1

    return -1

# Recursive version
def binary_search_recursive(arr: list[int], target: int,
                             low: int = 0, high: int = None) -> int:
    if high is None:
        high = len(arr) - 1
    if low > high:
        return -1

    mid = low + (high - low) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, high)
    else:
        return binary_search_recursive(arr, target, low, mid - 1)
```

**TypeScript:**

```typescript
function binarySearch(arr: number[], target: number): number {
    let low = 0, high = arr.length - 1;

    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
```

**Analysis:**
- **Recurrence:** T(n) = T(n/2) + O(1)
- **Time:** O(log n)
- **Space:** O(1) iterative, O(log n) recursive

---

### 4. Closest Pair of Points

**Problem:** Given n points in 2D, find the pair with the smallest Euclidean distance.

**Naive approach:** O(n^2) — check all pairs.

**D&C approach:** O(n log n)
1. Sort points by x-coordinate.
2. Divide into left and right halves.
3. Recursively find closest pair in each half: d_left, d_right.
4. Let d = min(d_left, d_right).
5. Check the **strip** of width 2d around the dividing line — only points within distance d
   of the dividing line could form a closer pair.
6. Key insight: For each point in the strip, we only need to check at most **7** subsequent
   points (sorted by y-coordinate) due to geometric packing arguments.

```
Closest Pair Visualization:

     y
     │
  8  │     *              *
     │         *
  6  │    *        │        *
     │             │ strip
  4  │  *      *   │   *
     │             │
  2  │       *     │      *
     │             │
     └─────────────┼────────── x
                   │
             dividing line

  d = min(d_left, d_right)
  Strip: points within d of the dividing line
  Only check pairs within the strip where |y1 - y2| < d
```

**Python:**

```python
import math

def closest_pair(points: list[tuple[float, float]]) -> tuple[float, tuple, tuple]:
    """Returns (distance, point1, point2)."""
    def dist(p1, p2):
        return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

    def brute_force(pts):
        min_d = float('inf')
        p1, p2 = None, None
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                d = dist(pts[i], pts[j])
                if d < min_d:
                    min_d = d
                    p1, p2 = pts[i], pts[j]
        return min_d, p1, p2

    def closest_strip(strip, d):
        min_d = d
        p1, p2 = None, None
        strip.sort(key=lambda p: p[1])  # sort by y

        for i in range(len(strip)):
            j = i + 1
            while j < len(strip) and (strip[j][1] - strip[i][1]) < min_d:
                dd = dist(strip[i], strip[j])
                if dd < min_d:
                    min_d = dd
                    p1, p2 = strip[i], strip[j]
                j += 1
        return min_d, p1, p2

    def solve(pts_x):
        n = len(pts_x)
        if n <= 3:
            return brute_force(pts_x)

        mid = n // 2
        mid_x = pts_x[mid][0]

        dl, pl1, pl2 = solve(pts_x[:mid])
        dr, pr1, pr2 = solve(pts_x[mid:])

        if dl < dr:
            d, best_p1, best_p2 = dl, pl1, pl2
        else:
            d, best_p1, best_p2 = dr, pr1, pr2

        # Build strip
        strip = [p for p in pts_x if abs(p[0] - mid_x) < d]
        ds, sp1, sp2 = closest_strip(strip, d)

        if ds < d:
            return ds, sp1, sp2
        return d, best_p1, best_p2

    sorted_x = sorted(points, key=lambda p: p[0])
    return solve(sorted_x)

points = [(2, 3), (12, 30), (40, 50), (5, 1), (12, 10), (3, 4)]
d, p1, p2 = closest_pair(points)
print(f"Closest pair: {p1}, {p2} with distance {d:.4f}")
# Closest pair: (2, 3), (3, 4) with distance 1.4142
```

**Analysis:**
- **Recurrence:** T(n) = 2T(n/2) + O(n log n) [due to sorting strip]
  With optimization (pre-sort by y): T(n) = 2T(n/2) + O(n) -> O(n log n)
- **Time:** O(n log n) with pre-sorting, O(n log^2 n) without

---

### 5. Strassen's Matrix Multiplication

**Problem:** Multiply two n x n matrices.

**Standard algorithm:** O(n^3) — each of the n^2 entries requires O(n) multiplications.

**Strassen's insight (1969):** By cleverly rearranging the computation, reduce 8 recursive
multiplications to **7**, at the cost of more additions.

```
Standard 2x2 Block Multiplication (8 multiplications):

  ┌       ┐   ┌       ┐     ┌                   ┐
  │ A   B  │ x │ E   F  │  =  │ AE+BG    AF+BH   │
  │ C   D  │   │ G   H  │     │ CE+DG    CF+DH   │
  └       ┘   └       ┘     └                   ┘

  8 multiplications: AE, BG, AF, BH, CE, DG, CF, DH

Strassen's 7 Products:

  P1 = A(F - H)          P5 = (A + D)(E + H)
  P2 = (A + B)H          P6 = (B - D)(G + H)
  P3 = (C + D)E          P7 = (A - C)(E + F)
  P4 = D(G - E)

  Result:
  ┌                                    ┐
  │ P5 + P4 - P2 + P6     P1 + P2      │
  │ P3 + P4               P1 + P5 - P3 - P7 │
  └                                    ┘

  7 multiplications + 18 additions/subtractions
```

**Recurrence:**
- Standard: T(n) = 8T(n/2) + O(n^2) -> O(n^3)
- Strassen: T(n) = 7T(n/2) + O(n^2) -> O(n^log2(7)) = O(n^2.807)

**Python (conceptual implementation):**

```python
import numpy as np

def strassen(A, B):
    """Strassen's matrix multiplication for square matrices (size must be power of 2)."""
    n = len(A)
    if n == 1:
        return A * B

    mid = n // 2

    # Split matrices into quadrants
    A11, A12 = A[:mid, :mid], A[:mid, mid:]
    A21, A22 = A[mid:, :mid], A[mid:, mid:]
    B11, B12 = B[:mid, :mid], B[:mid, mid:]
    B21, B22 = B[mid:, :mid], B[mid:, mid:]

    # Strassen's 7 products
    P1 = strassen(A11, B12 - B22)
    P2 = strassen(A11 + A12, B22)
    P3 = strassen(A21 + A22, B11)
    P4 = strassen(A22, B21 - B11)
    P5 = strassen(A11 + A22, B11 + B22)
    P6 = strassen(A12 - A22, B21 + B22)
    P7 = strassen(A11 - A21, B11 + B12)

    # Combine
    C11 = P5 + P4 - P2 + P6
    C12 = P1 + P2
    C21 = P3 + P4
    C22 = P1 + P5 - P3 - P7

    # Assemble result
    C = np.zeros((n, n))
    C[:mid, :mid] = C11
    C[:mid, mid:] = C12
    C[mid:, :mid] = C21
    C[mid:, mid:] = C22
    return C
```

**Practical notes:**
- Constant factor in Strassen is large; it only outperforms standard multiplication for matrices
  roughly larger than 64x64 (depends on hardware).
- Numerical stability is slightly worse than standard multiplication.
- Modern improvements: Coppersmith-Winograd O(n^2.376), current best is O(n^2.3728596) by
  Alman & Vassilevska Williams (2024).

---

### 6. Karatsuba Multiplication

**Problem:** Multiply two n-digit numbers.

**Standard:** O(n^2) digit multiplications (grade school algorithm).

**Karatsuba's insight (1960):** Reduce 4 multiplications to **3** using algebraic identity.

```
To multiply x * y where:
  x = a * 10^m + b    (split x into upper half a and lower half b)
  y = c * 10^m + d    (split y into upper half c and lower half d)

Standard:
  x * y = ac * 10^(2m) + (ad + bc) * 10^m + bd
  Requires 4 multiplications: ac, ad, bc, bd

Karatsuba's trick:
  Compute only 3 multiplications:
    z0 = bd
    z2 = ac
    z1 = (a + b)(c + d) - z0 - z2   ← this equals ad + bc!

  x * y = z2 * 10^(2m) + z1 * 10^m + z0

Why it works:
  (a+b)(c+d) = ac + ad + bc + bd
  (a+b)(c+d) - ac - bd = ad + bc    ← the cross term we need!
```

**Python:**

```python
def karatsuba(x: int, y: int) -> int:
    """Multiply two integers using Karatsuba algorithm."""
    # Base case
    if x < 10 or y < 10:
        return x * y

    # Determine the size
    n = max(len(str(abs(x))), len(str(abs(y))))
    m = n // 2

    # Split the numbers
    power = 10 ** m
    a, b = divmod(x, power)   # x = a * 10^m + b
    c, d = divmod(y, power)   # y = c * 10^m + d

    # Three recursive multiplications
    z0 = karatsuba(b, d)
    z2 = karatsuba(a, c)
    z1 = karatsuba(a + b, c + d) - z2 - z0

    return z2 * (10 ** (2 * m)) + z1 * (10 ** m) + z0

# Example
print(karatsuba(1234, 5678))    # 7006652
print(1234 * 5678)              # 7006652 (verification)

# Large number multiplication
a = 3141592653589793238462643383279502884197
b = 2718281828459045235360287471352662497757
print(karatsuba(a, b) == a * b)  # True
```

**TypeScript:**

```typescript
function karatsuba(x: bigint, y: bigint): bigint {
    if (x < 10n || y < 10n) return x * y;

    const n = Math.max(x.toString().length, y.toString().length);
    const m = Math.floor(n / 2);
    const power = 10n ** BigInt(m);

    const a = x / power;
    const b = x % power;
    const c = y / power;
    const d = y % power;

    const z0 = karatsuba(b, d);
    const z2 = karatsuba(a, c);
    const z1 = karatsuba(a + b, c + d) - z2 - z0;

    return z2 * (10n ** BigInt(2 * m)) + z1 * (10n ** BigInt(m)) + z0;
}

console.log(karatsuba(1234n, 5678n)); // 7006652n
```

**Analysis:**
- **Recurrence:** T(n) = 3T(n/2) + O(n)
- **Time:** O(n^log2(3)) = O(n^1.585)
- **Practical use:** Used in big-number libraries; Python's built-in `int` multiplication uses
  Karatsuba for sufficiently large numbers.

---

### 7. Maximum Subarray

**Problem:** Find the contiguous subarray with the largest sum.

**D&C Approach:** The maximum subarray is either entirely in the left half, entirely in the right
half, or crosses the midpoint.

```
Maximum Subarray — D&C:

  arr = [-2, 1, -3, 4, -1, 2, 1, -5, 4]

  Left half:  [-2, 1, -3, 4]
  Right half: [-1, 2, 1, -5, 4]

  Max crossing: extends left from mid AND right from mid
    Left extension:  4         → sum = 4
    Right extension: -1, 2, 1  → sum = 2
    Crossing sum = 4 + 2 = 6    ← subarray [4, -1, 2, 1]

  Answer: max(left_max, right_max, crossing_max) = max(4, 4, 6) = 6
```

**Python — D&C vs Kadane's:**

```python
# D&C approach — O(n log n)
def max_subarray_dc(arr: list[int]) -> int:
    def solve(lo: int, hi: int) -> int:
        if lo == hi:
            return arr[lo]

        mid = (lo + hi) // 2

        # Find max crossing subarray
        left_sum = float('-inf')
        total = 0
        for i in range(mid, lo - 1, -1):
            total += arr[i]
            left_sum = max(left_sum, total)

        right_sum = float('-inf')
        total = 0
        for i in range(mid + 1, hi + 1):
            total += arr[i]
            right_sum = max(right_sum, total)

        cross_sum = left_sum + right_sum

        return max(solve(lo, mid), solve(mid + 1, hi), cross_sum)

    return solve(0, len(arr) - 1)

# Kadane's algorithm — O(n) iterative (NOT D&C, but important comparison)
def max_subarray_kadane(arr: list[int]) -> int:
    max_ending = max_so_far = arr[0]

    for i in range(1, len(arr)):
        max_ending = max(arr[i], max_ending + arr[i])
        max_so_far = max(max_so_far, max_ending)

    return max_so_far

arr = [-2, 1, -3, 4, -1, 2, 1, -5, 4]
print(max_subarray_dc(arr))      # 6
print(max_subarray_kadane(arr))  # 6
```

**TypeScript — Kadane's (the practical choice):**

```typescript
function maxSubarrayKadane(arr: number[]): number {
    let maxEnding = arr[0];
    let maxSoFar = arr[0];

    for (let i = 1; i < arr.length; i++) {
        maxEnding = Math.max(arr[i], maxEnding + arr[i]);
        maxSoFar = Math.max(maxSoFar, maxEnding);
    }
    return maxSoFar;
}

console.log(maxSubarrayKadane([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6
```

**Comparison:**
| Approach | Time | Space | Notes |
|---|---|---|---|
| D&C | O(n log n) | O(log n) stack | Demonstrates D&C concept |
| Kadane's | O(n) | O(1) | Practical choice, DP-based |

---

## Analyzing D&C with the Master Theorem

The **Master Theorem** provides a direct way to solve recurrences of the form:

```
T(n) = aT(n/b) + O(n^d)

where:
  a = number of subproblems
  b = factor by which problem size shrinks
  d = exponent of the work done outside recursive calls
```

**Three Cases:**

```
Case 1: d < log_b(a)  →  T(n) = O(n^(log_b(a)))     Work dominated by leaves
Case 2: d = log_b(a)  →  T(n) = O(n^d * log n)       Work balanced across levels
Case 3: d > log_b(a)  →  T(n) = O(n^d)               Work dominated by root
```

### Application to D&C Algorithms

```
Algorithm           a    b    d    log_b(a)   Case   Result
─────────────────────────────────────────────────────────────────
Binary Search       1    2    0    0          2      O(log n)
Merge Sort          2    2    1    1          2      O(n log n)
Quick Sort (avg)    2    2    1    1          2      O(n log n)
Strassen            7    2    2    2.807      1      O(n^2.807)
Karatsuba           3    2    1    1.585      1      O(n^1.585)
Closest Pair        2    2    1    1          2      O(n log n)
Max Subarray (D&C)  2    2    1    1          2      O(n log n)
```

```
Recursion Tree for T(n) = 2T(n/2) + O(n)  [Merge Sort]:

Level 0:          cn                    → cn work
                /    \
Level 1:     cn/2    cn/2               → cn work
            / \      / \
Level 2:  cn/4 cn/4 cn/4 cn/4           → cn work
           ...                           ...
Level k:  n leaves of O(1) each         → cn work

Total levels: log n
Total work: cn * log n = O(n log n)

Each level does O(n) work → Case 2 of Master Theorem.
```

---

## D&C vs Dynamic Programming

```
Feature               Divide and Conquer              Dynamic Programming
─────────────────────────────────────────────────────────────────────────────
Subproblems           Independent (no overlap)         Overlapping
Approach              Top-down recursive               Bottom-up (or top-down + memo)
Combining             Merge step after recursion       Table lookup
Redundant work        None (subproblems disjoint)      Avoided via memoization
Examples              Merge Sort, Binary Search        Fibonacci, Knapsack, LCS
Typical recurrence    T(n) = aT(n/b) + f(n)           dp[i] = f(dp[j], ...)
```

**When D&C subproblems overlap, switch to DP:**
- Naive recursive Fibonacci is D&C with overlapping subproblems → O(2^n)
- Memoized Fibonacci is DP → O(n)
- Matrix Chain Multiplication has overlapping subproblems → use DP, not plain D&C

---

## Additional D&C Applications

### Counting Inversions
Count pairs (i, j) where i < j but arr[i] > arr[j]. Modified merge sort counts inversions
during the merge step. Time: O(n log n).

### Fast Fourier Transform (FFT)
Multiply two polynomials in O(n log n) instead of O(n^2). Divides the polynomial evaluation
into even and odd components. Foundation of signal processing.

### Median of Medians (Deterministic Selection)
Find the k-th smallest element in O(n) worst case. Uses D&C with a carefully chosen pivot
(median of groups of 5). Guarantees at least 30% of elements are eliminated each step.

---

## Practical Considerations

1. **Base case size matters.** For small inputs, the overhead of recursion and splitting exceeds
   the benefit. Production merge sort switches to insertion sort for arrays smaller than ~16
   elements (known as "timsort" hybrid approach).

2. **Stack depth.** Deep recursion can cause stack overflow. Quick sort can degrade to O(n)
   stack depth in the worst case. Use tail-call optimization or iterative approaches for
   production code.

3. **Cache performance.** D&C algorithms that access data sequentially (merge sort) are more
   cache-friendly than those with random access patterns.

4. **Parallelism.** D&C algorithms are naturally parallelizable — independent subproblems can
   be solved on different processors/threads. Fork-join parallelism maps directly to D&C.

---

## Sources

- **Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C.** *Introduction to Algorithms*
  (CLRS), Chapter 4: Divide-and-Conquer.
- **Karatsuba, A. & Ofman, Y.** (1962). "Multiplication of Multidigit Numbers on Automata."
  *Soviet Physics Doklady*, 7, 595-596.
- **Strassen, V.** (1969). "Gaussian Elimination is Not Optimal." *Numerische Mathematik*,
  13(4), 354-356.
- **Skiena, S. S.** *The Algorithm Design Manual*, Chapter 4: Sorting and Searching.
- **Dasgupta, S., Papadimitriou, C., & Vazirani, U.** *Algorithms*, Chapter 2: Divide-and-Conquer.
- **Wikipedia** — Divide-and-Conquer Algorithm:
  https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm
